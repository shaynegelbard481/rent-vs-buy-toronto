import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar, LabelList,
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
  buy: '#6366f1',
  rent: '#10b981',
  equity: '#818cf8',
  portfolio: '#34d399',
};

// ─── Headline card ────────────────────────────────────────────────────────────

export function HeadlineCard({ buyFinal, rentFinal, breakEvenYear, horizonYears, buySnapshots, rentSnapshots }) {
  const buyWins = buyFinal > rentFinal;
  const delta = Math.abs(buyFinal - rentFinal);
  const winner = buyWins ? 'Buying' : 'Renting';
  const winnerColor = buyWins ? 'text-indigo-600' : 'text-emerald-600';
  const winnerBg = buyWins ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200';

  const buyInsolventYear = buySnapshots?.find(s => s.portfolioInsolvent)?.year;
  const rentInsolventYear = rentSnapshots?.find(s => s.portfolioInsolvent)?.year;
  const buyFullyInsolvent = buySnapshots?.some(s => s.fullyInsolvent);
  const rentFullyInsolvent = rentSnapshots?.some(s => s.fullyInsolvent);
  const anyInsolvent = buyInsolventYear || rentInsolventYear;

  return (
    <div className="flex flex-col gap-3">
      {anyInsolvent && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4">
          <p className="text-sm font-bold text-red-700 mb-1">⚠ Affordability Warning</p>
          <p className="text-xs text-red-600">
            {buyInsolventYear && `Buy scenario: investment portfolio depleted by Year ${buyInsolventYear} — you would need to take on debt or sell assets to continue. `}
            {rentInsolventYear && `Rent scenario: investment portfolio depleted by Year ${rentInsolventYear}. `}
            {(buyFullyInsolvent || rentFullyInsolvent) && 'One or both scenarios result in negative net worth. Adjust income, expenses, or purchase price.'}
          </p>
        </div>
      )}
      <div className={`rounded-2xl border-2 p-6 ${winnerBg}`}>
        <p className="text-sm font-medium text-slate-500 mb-1">Over {horizonYears} years</p>
        <h2 className={`text-3xl font-bold ${winnerColor} mb-2`}>
          {winner} wins by {formatDollar(delta)}
        </h2>
        <div className="flex flex-wrap gap-6 mt-4">
          <div>
            <p className="text-xs text-slate-500">Buy net worth</p>
            <p className={`text-xl font-semibold ${buyFinal < 0 ? 'text-red-600' : 'text-indigo-600'}`}>{formatDollarFull(buyFinal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Rent net worth</p>
            <p className={`text-xl font-semibold ${rentFinal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatDollarFull(rentFinal)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Break-even year</p>
            <p className="text-xl font-semibold text-slate-700">
              {breakEvenYear ? `Year ${breakEvenYear}` : `Not within ${horizonYears} yrs`}
            </p>
          </div>
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
          <Line type="monotone" dataKey="buyNetWorth" name="Buy" stroke={COLORS.buy} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="rentNetWorth" name="Rent" stroke={COLORS.rent} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Monthly cash flow comparison ────────────────────────────────────────────

function AffordabilityLabel({ surplus, monthlyIncome }) {
  if (surplus >= 0) {
    return (
      <p className="text-xs mt-1 font-medium text-emerald-600">
        +{formatDollarFull(surplus)}/mo surplus invested
      </p>
    );
  }
  const shortfall = Math.abs(surplus);
  // Flag severity: if shortfall > 30% of income, it's a real problem
  const severe = monthlyIncome > 0 && shortfall > monthlyIncome * 0.3;
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${severe ? 'bg-red-100 border border-red-300' : 'bg-amber-50 border border-amber-200'}`}>
      <p className={`font-semibold ${severe ? 'text-red-700' : 'text-amber-700'}`}>
        {formatDollarFull(shortfall)}/mo gap
      </p>
      <p className={`mt-0.5 ${severe ? 'text-red-600' : 'text-amber-600'}`}>
        {severe
          ? 'This exceeds 30% of your income — this scenario may not be affordable without drawing down savings.'
          : 'Your investment portfolio would need to cover this gap each month.'}
      </p>
    </div>
  );
}

export function CashFlowCard({ buySnapshot, rentSnapshot, monthlyIncome }) {
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
          <p className="text-2xl font-bold text-indigo-700">
            {formatDollarFull(buyHousing)}<span className="text-sm font-normal">/mo</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Mortgage + tax + maintenance + insurance + utilities</p>
          <AffordabilityLabel surplus={buySnapshot.monthlySurplus} monthlyIncome={monthlyIncome} />
        </div>
        <div className="bg-emerald-50 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1">Rent</p>
          <p className="text-2xl font-bold text-emerald-700">
            {formatDollarFull(rentHousing)}<span className="text-sm font-normal">/mo</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Rent + utilities</p>
          <AffordabilityLabel surplus={rentSnapshot.monthlySurplus} monthlyIncome={monthlyIncome} />
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

// ─── Wealth composition chart with data labels ────────────────────────────────

const BarLabel = ({ x, y, width, value }) => {
  if (!value || value < 50000) return null;
  return (
    <text x={x + width / 2} y={y - 4} fill="#475569" fontSize={10} textAnchor="middle">
      {formatDollar(value)}
    </text>
  );
};

export function WealthCompositionChart({ chartData }) {
  const filtered = chartData.filter((_, i) => i % 2 === 1 || i === 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Wealth Composition</h3>
      <p className="text-xs text-slate-400 mb-4">Buy scenario: home equity vs. investment portfolio</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={filtered} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={70} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="buyEquity" name="Home equity (net)" stackId="buy" fill={COLORS.equity}>
            <LabelList content={<BarLabel />} position="top" />
          </Bar>
          <Bar dataKey="buyPortfolio" name="Investment portfolio" stackId="buy" fill={COLORS.buy} radius={[4, 4, 0, 0]}>
            <LabelList content={<BarLabel />} position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Year-by-year table with download button ──────────────────────────────────

export function DetailTable({ buySnapshots, rentSnapshots }) {
  const [open, setOpen] = React.useState(false);
  const [downloadTooltip, setDownloadTooltip] = React.useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 hover:text-indigo-600 transition-colors"
        >
          <span className="font-semibold text-slate-900">Year-by-Year Breakdown</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className="relative">
          <button
            onMouseEnter={() => setDownloadTooltip(true)}
            onMouseLeave={() => setDownloadTooltip(false)}
            className="flex items-center gap-1.5 text-xs text-slate-400 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV
          </button>
          {downloadTooltip && (
            <div className="absolute right-0 top-8 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap z-10">
              Export coming in v2.0
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
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
