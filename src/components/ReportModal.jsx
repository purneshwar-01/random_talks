import { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';

const REASONS = [
  'Spam',
  'Harassment',
  'Inappropriate Content',
  'Underage User',
  'Other',
];

export default function ReportModal({ onSubmit, onClose }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    await onSubmit({ reason, details, alsoBlock });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans text-slate-900">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl relative">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <ShieldAlert size={20} className="text-red-600" /> Report & Add Strike
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Reporting adds a strike to this user. 3 strikes result in an automatic account ban.
        </p>

        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-red-500"
        >
          {REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Additional details (optional)"
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-red-500 h-20"
        />

        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="rounded border-slate-300 text-red-600 focus:ring-0"
          />
          Never match with this user again (Block)
        </label>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs shadow-md transition disabled:opacity-50"
        >
          {submitting ? 'Applying Strike & Report...' : 'Submit Report & Leave Call'}
        </button>
      </div>
    </div>
  );
}
