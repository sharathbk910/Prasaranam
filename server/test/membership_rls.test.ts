import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/store.js';

describe('Phase 1: Multi-Tenant Memberships, Auth & Row-Level Security', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  describe('Database / Store RLS Level', () => {
    it('allows a project creator/member to read their project', () => {
      // User A (Elena) is owner of proj-solarpulse-01
      const project = db.getProjectForUser('proj-solarpulse-01', 'user-elena-lead');
      expect(project).toBeDefined();
      expect(project?.name).toBe('Project SolarPulse');
    });

    it('blocks a non-member from reading another user project at the RLS level', () => {
      // Create User A and User B
      const userA = db.signUp('user-a@example.com', 'Pass1234!', 'User Alpha');
      const userB = db.signUp('user-b@example.com', 'Pass1234!', 'User Beta');

      // User A creates a confidential project
      const projA = db.createProject('Project Alpha Stealth', 'Internal confidential project', userA.user.id);

      // User A can read it
      expect(db.getProjectForUser(projA.id, userA.user.id)).toBeDefined();

      // User B is NOT a member: RLS MUST return undefined!
      const nonMemberRead = db.getProjectForUser(projA.id, userB.user.id);
      expect(nonMemberRead).toBeUndefined();

      // User B project list must NOT contain User A's project
      const userBProjects = db.getProjectsForUser(userB.user.id);
      expect(userBProjects.some(p => p.id === projA.id)).toBe(false);
    });
  });

  describe('API Level Auth, Protected Pages & Membership Enforcement', () => {
    it('requires authentication for /api/projects', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('allows a user to sign up, sign in, and access protected endpoints', async () => {
      // 1. Sign up
      const signupRes = await request(app).post('/api/auth/signup').send({
        email: 'engineer1@example.com',
        password: 'Password123!',
        name: 'Engineer One',
      });
      expect(signupRes.status).toBe(201);
      expect(signupRes.body.token).toBeDefined();
      expect(signupRes.body.user.email).toBe('engineer1@example.com');
      const token = signupRes.body.token;

      // 2. Fetch authenticated profile /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.name).toBe('Engineer One');

      // 3. User creates a project
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Telemetry Edge Gateway',
          description: 'Edge computing daemon for clinic solar microgrids',
        });
      expect(createRes.status).toBe(201);
      const projectId = createRes.body.id;

      // 4. User can read their project
      const readRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(readRes.status).toBe(200);
      expect(readRes.body.name).toBe('Telemetry Edge Gateway');

      // 5. Sign-out ends access to protected pages
      const signoutRes = await request(app)
        .post('/api/auth/signout')
        .set('Authorization', `Bearer ${token}`);
      expect(signoutRes.status).toBe(200);

      // Subsequent access with the signed-out token is rejected
      const rejectedRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(rejectedRes.status).toBe(401);
    });

    it('denies a non-member from reading another user project (returns 403 Forbidden)', async () => {
      // Sign up User 1
      const user1Res = await request(app).post('/api/auth/signup').send({
        email: 'alice@example.com',
        password: 'Password123!',
        name: 'Alice Cooper',
      });
      const token1 = user1Res.body.token;

      // Sign up User 2
      const user2Res = await request(app).post('/api/auth/signup').send({
        email: 'bob@example.com',
        password: 'Password123!',
        name: 'Bob Marley',
      });
      const token2 = user2Res.body.token;

      // Alice creates a private project
      const projRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: 'Alice Secret Project',
          description: 'Private records not for public view',
        });
      const aliceProjId = projRes.body.id;

      // Alice can read her project
      const aliceReadRes = await request(app)
        .get(`/api/projects/${aliceProjId}`)
        .set('Authorization', `Bearer ${token1}`);
      expect(aliceReadRes.status).toBe(200);

      // Bob tries to read Alice's project -> MUST BE REJECTED with 403
      const bobReadRes = await request(app)
        .get(`/api/projects/${aliceProjId}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(bobReadRes.status).toBe(403);
      expect(bobReadRes.body.error).toContain('Access denied');

      // Bob's project list must NOT contain Alice's project
      const bobProjectsRes = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token2}`);
      expect(bobProjectsRes.status).toBe(200);
      expect(bobProjectsRes.body.some((p: any) => p.id === aliceProjId)).toBe(false);
    });
  });
});

