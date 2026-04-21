import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar
} from 'recharts';

function formatDollar(v) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatDollarFull(v) {
  return `$${Math.round(v).toLocaleString()}`;
}

const COLORS = {
  buy: '#6366f1',   // indigo
  rent: '#10b981',  // emerald
  equity: '#818cf8',
  portfolio: '#34d399',
};

// ─── Headline card ────────────────────────────────────────────────────────────

export function HeadlineCard({ buyFinal, rentFinal, breakEvenYear, horizonYears }) {
  const buyWins = buyFinal > rentFinal;
  const delta = Math.abs(buyFinal - rentFinal);
  const winner = buyWins ? 'Buying' : 'Renting';
  const winnerColor = buyWins ? 'text-indigo-600' : 'text-emerald-600';
  const winnerBg = buyWins ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200';

  return (
    <div className={`rounded-2xl border-2 p-6 ${winnerBg}`}>
      <p className="text-sm font-medium text-slate-500 mb-1">Over {horizonYears} years</p>
      <h2 className={`text-3xl font-bold ${winnerColor} mb-2`}>
        {winner} wins by {formatDollar(delta)}
      </h2>
      <div className="flex flex-wrap gap-6 mt-4">
        <div>
          <p className="text-xs text-slate-500">Buy net worth</p>
          <p className="text-xl font-semibold text-indigo-600">{formatDollarFull(buyFinal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Rent net worth</p>
          <p className="text-xl font-semibold text-emerald-600">{formatDollarFull(rentFinal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Break-even year</p>
          <p className="text-xl font-semibold text-slate-700">
            {breakEvenYear ? `Year ${breakEvenYear}` : `Not within ${horizonYears} yrs`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Net worth chart ──────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-6">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{formatDollarFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function NetWorthChart({ chartData, breakEvenYear }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Net Worth Over Time</h3>
      <p className="text-xs text-slate-400 mb-4">After-tax, including all costs and selling fees at exit</p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={70} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {breakEvenYear && (
            <ReferenceLine
              x={`Yr ${breakEvenYear}`}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: 'Break-even', position: 'top', fontSize: 11, fill: '#94a3b8' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="buyNetWorth"
            name="Buy"
            stroke={COLORS.buy}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="rentNetWorth"
            name="Rent"
            stroke={COLORS.rent}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Monthly cash flow comparison ────────────────────────────────────────────

export function CashFlowCard({ buySnapshot, rentSnapshot }) {
  const buyHousing = buySnapshot.monthlyHousingCost;
  const rentHousing = rentSnapshot.monthlyHousingCost;
  const delta = buyHousing - rentHousing;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Monthly Cash Flow (Year 1)</h3>
      <p className="text-xs text-slate-400 mb-4">Total housing outlay per month</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4">
          <p className="text-xs text-indigo-600 font-medium mb-1">Buy</p>
          <p className="text-2xl font-bold text-indigo-700">{formatDollarFull(buyHousing)}<span className="text-sm font-normal">/mo</span></p>
          <p className="text-xs text-slate-500 mt-2">Mortgage + property tax + maintenance + insurance + utilities</p>
          <p className={`text-xs mt-1 font-medium ${buySnapshot.monthlySurplus >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {buySnapshot.monthlySurplus >= 0 ? `+${formatDollarFull(buySnapshot.monthlySurplus)} surplus invested` : `${formatDollarFull(buySnapshot.monthlySurplus)} monthly shortfall`}
          </p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1">Rent</p>
          <p className="text-2xl font-bold text-emerald-700">{formatDollarFull(rentHousing)}<span className="text-sm font-normal">/mo</span></p>
          <p className="text-xs text-slate-500 mt-2">Rent + utilities</p>
          <p className={`text-xs mt-1 font-medium ${rentSnapshot.monthlySurplus >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {rentSnapshot.monthlySurplus >= 0 ? `+${formatDollarFull(rentSnapshot.monthlySurplus)} surplus invested` : `${formatDollarFull(rentSnapshot.monthlySurplus)} monthly shortfall`}
          </p>
        </div>
      </div>
      {delta !== 0 && (
        <p className="text-sm text-slate-600 mt-4 text-center">
          Buying costs <span className="font-semibold">{formatDollarFull(Math.abs(delta))}/mo {delta > 0 ? 'more' : 'less'}</span> than renting in Year 1
        </p>
      )}
    </div>
  );
}

// ─── Wealth composition chart ─────────────────────────────────────────────────

export function WealthCompositionChart({ chartData }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Wealth Composition</h3>
      <p className="text-xs text-slate-400 mb-4">Buy scenario: home equity vs. investment portfolio</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData.filter((_, i) => i % 2 === 1 || i === 0)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={70} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="buyEquity" name="Home equity (net)" stackId="buy" fill={COLORS.equity} radius={[0,0,0,0]} />
          <Bar dataKey="buyPortfolio" name="Investment portfolio" stackId="buy" fill={COLORS.buy} radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Year-by-year table ───────────────────────────────────────────────────────

export function DetailTable({ buySnapshots, rentSnapshots }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-900">Year-by-Year Breakdown</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-t border-b border-slate-200">
              <tr>
                {['Year', 'Buy NW', 'Rent NW', 'Delta', 'Buy Housing/mo', 'Rent Housing/mo', 'Home Value', 'Mortgage Balance'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buySnapshots.map((b, i) => {
                const r = rentSnapshots[i];
                const delta = b.totalNetWorth - r.totalNetWorth;
                const buyWins = delta > 0;
                return (
                  <tr key={b.year} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{b.year}</td>
                    <td className="px-4 py-3 text-indigo-600 font-medium">{formatDollar(b.totalNetWorth)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">{formatDollar(r.totalNetWorth)}</td>
                    <td className={`px-4 py-3 font-semibold ${buyWins ? 'text-indigo-600' : 'text-emerald-600'}`}>
                      {buyWins ? '+' : ''}{formatDollar(delta)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDollarFull(b.monthlyHousingCost)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDollarFull(r.monthlyHousingCost)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDollar(b.homeValue)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDollar(b.mortgageBalance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
