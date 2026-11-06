import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationBadge, ClearanceBadge } from '../components/Badges.js';

describe('VerificationBadge Component', () => {
  it('renders supported status with text label and icon', () => {
    render(<VerificationBadge status="supported" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Supported')).toBeInTheDocument();
  });

  it('renders needs confirmation status without percentage numbers (Rule 6)', () => {
    render(<VerificationBadge status="needs confirmation" />);
    expect(screen.getByText('Needs Confirmation')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders conflicting and corroborated status with explicit text labels', () => {
    const { rerender } = render(<VerificationBadge status="conflicting" />);
    expect(screen.getByText('Conflicting')).toBeInTheDocument();

    rerender(<VerificationBadge status="corroborated" />);
    expect(screen.getByText('Corroborated')).toBeInTheDocument();
  });
});

describe('ClearanceBadge Component', () => {
  it('renders clearance badges with proper text labels', () => {
    const { rerender } = render(<ClearanceBadge level="restricted" />);
    expect(screen.getByText('Restricted')).toBeInTheDocument();

    rerender(<ClearanceBadge level="confidential" />);
    expect(screen.getByText('Confidential')).toBeInTheDocument();

    rerender(<ClearanceBadge level="internal" />);
    expect(screen.getByText('Internal')).toBeInTheDocument();

    rerender(<ClearanceBadge level="public" />);
    expect(screen.getByText('Public')).toBeInTheDocument();
  });
});

