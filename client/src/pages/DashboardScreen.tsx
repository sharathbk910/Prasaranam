import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchHandovers, fetchProjects, fetchUsers } from '../lib/api.js';
import { HandoverStatusBadge, ClearanceBadge } from '../components/Badges.js';
import { PlusCircle, ArrowRight, Shield, Database, Users, CheckCircle, Clock } from 'lucide-react';

export const DashboardScreen: React.FC = () => {
  const { data: handovers = [], isLoading: loadingHandovers } = useQuery({
    queryKey: ['handovers'],
    queryFn: () => fetchHandovers(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-800 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-sky-100">
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Secure Knowledge Reconstitution</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Prasaranam Handover Hub
          </h1>
          <p className="text-sm sm:text-base text-sky-100 leading-relaxed">
            Reconstruct project states from authorized sources with exact passage verification.
            Restricted data is strictly filtered before prompt generation, and every handover requires human sign-off.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/generate"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white text-sky-800 font-bold text-sm shadow hover:bg-sky-50 transition min-h-[44px] min-w-[44px]"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Create New Handover</span>
            </Link>
            <Link
              to="/sources"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sky-700/60 hover:bg-sky-700 text-white font-medium text-sm transition min-h-[44px] min-w-[44px] border border-white/20"
            >
              <Database className="w-4 h-4" aria-hidden="true" />
              <span>Browse Knowledge Sources</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <Database className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Projects</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{projects.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <Clock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Handovers</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{handovers.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved Plans</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {handovers.filter(h => h.status === 'approved' || h.status === 'shared').length}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            <Users className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Synthetic Team Members</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{users.length}</p>
          </div>
        </div>
      </div>

      {/* Handover Plans Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Handover Reconstitution Plans
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Plans generated with exact source verification and recipient clearance filtering.
            </p>
          </div>
          <Link
            to="/generate"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-800 min-h-[44px]"
          >
            <span>Initiate Handover</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {loadingHandovers ? (
          <div className="p-8 text-center text-slate-500 animate-pulse">Loading handover plans...</div>
        ) : handovers.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3 bg-white dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-400">No handover plans generated yet.</p>
            <Link
              to="/generate"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Create First Handover</span>
            </Link>
          </div>
        ) : (
          /*
            Rule 12:
            Tables with many columns become stacked cards below 768px.
            Keep all data visible; do not hide columns silently.
          */
          <div>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Plan Title & Project</th>
                    <th scope="col" className="px-6 py-3.5">Departing &rarr; Recipient</th>
                    <th scope="col" className="px-6 py-3.5">Recipient Clearance</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5">Items</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {handovers.map(plan => (
                    <tr key={plan.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{plan.title}</div>
                        <div className="text-xs text-slate-500">{plan.project_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-900 dark:text-slate-200 font-medium">{plan.departing_user_name}</div>
                        <div className="text-xs text-sky-600 dark:text-sky-400">➔ {plan.recipient_user_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <ClearanceBadge level={plan.recipient_clearance} />
                      </td>
                      <td className="px-6 py-4">
                        <HandoverStatusBadge status={plan.status} />
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-200">
                        {plan.items.length} items
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/handovers/${plan.id}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100 font-medium text-xs min-h-[44px]"
                        >
                          <span>Review & Audit</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards View (< 768px) - Full Data Retained */}
            <div className="md:hidden space-y-4">
              {handovers.map(plan => (
                <div
                  key={plan.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        {plan.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {plan.project_name}
                      </p>
                    </div>
                    <HandoverStatusBadge status={plan.status} />
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-500">Departing:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{plan.departing_user_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-500">Recipient:</span>
                      <span className="font-medium text-sky-600 dark:text-sky-400">{plan.recipient_user_name}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="font-semibold text-slate-500">Recipient Clearance:</span>
                      <ClearanceBadge level={plan.recipient_clearance} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-500">Verified Items:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{plan.items.length} items</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      to={`/handovers/${plan.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm min-h-[44px] transition"
                    >
                      <span>Review & Audit Handover</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
