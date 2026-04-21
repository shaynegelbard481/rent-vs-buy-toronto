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

  // Debt at end of horizon for each insolvent scenario
  const buyFinalPortfolio = buySnapshots?.[buySnapshots.length - 1]?.portfolioAfterTax ?? 0;
  const rentFinalPortfolio = rentSnapshots?.[rentSnapshots.length - 1]?.portfolioAfterTax ?? 0;
  const buyMonthlySurplus = buySnapshots?.[0]?.monthlySurplus ?? 0;
  const rentMonthlySurplus = rentSnapshots?.[0]?.monthlySurplus ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {anyInsolvent && (
        <div className={`border-2 rounded-2xl px-5 py-4 space-y-2 ${buyFullyInsolvent || rentFullyInsolvent ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'}`}>
          <p className={`text-sm font-bold ${buyFullyInsolvent || rentFullyInsolvent ? 'text-red-800' : 'text-amber-800'}`}>
            ⚠ Debt Accumulation Warning
          </p>
          {buyInsolventYear && (
            <div className="text-xs text-amber-700 space-y-0.5">
              <p>
                <span className="font-semibold">Buy scenario:</span> liquid savings run out in Year {buyInsolventYear}.
                After that, you're accumulating approximately <span className="font-semibold">{formatDollarFull(Math.abs(buyMonthlySurplus))}/mo in debt</span> to fund the gap between your income and housing costs.
              </p>
              {buyFinalPortfolio < 0 && (
                <p>By Year {horizonYears}, this debt totals <span className="font-semibold text-red-700">{formatDollarFull(Math.abs(buyFinalPortfolio))}</span> — shown as the dashed line crossing below zero on the chart. Total net worth remains positive only because home equity offsets it.</p>
              )}
            </div>
          )}
          {rentInsolventYear && (
            <div className="text-xs space-y-0.5">
              <p className="text-red-700">
                <span className="font-semibold">Rent scenario:</span> liquid savings run out in Year {rentInsolventYear}.
                Accumulating ~<span className="font-semibold">{formatDollarFull(Math.abs(rentMonthlySurplus))}/mo in debt</span> after that point — with no home equity to offset it, this leads to genuine negative net worth.
              </p>
              {rentFinalPortfolio < 0 && (
                <p className="font-semibold text-red-700">Total debt by Year {horizonYears}: {formatDollarFull(Math.abs(rentFinalPortfolio))}</p>
              )}
            </div>
          )}
          {(buyFullyInsolvent || rentFullyInsolvent) && (
            <p className="text-xs text-red-700 font-semibold border-t border-red-200 pt-2">
              Total net worth goes negative — this scenario is not sustainable. Increase income, reduce purchase price, or lower monthly expenses.
            </p>
          )}
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
  const portfolioDepletedYear = chartData.find(d => d.buyInsolvent)?.year;
  const rentDepletedYear = chartData.find(d => d.rentInsolvent)?.year;
  const showPortfolioLine = portfolioDepletedYear || chartData.some(d => d.buyPortfolio < 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Net Worth Over Time</h3>
      <p className="text-xs text-slate-400 mb-1">After-tax total net worth, including all costs and selling fees at exit</p>
      {showPortfolioLine && (
        <p className="text-xs text-amber-600 mb-3">Dashed line shows buy scenario liquid portfolio — when it dips below $0, total net worth is sustained by home equity alone.</p>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={70} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />
          {breakEvenYear && (
            <ReferenceLine
              x={`Yr ${breakEvenYear}`}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: 'Break-even', position: 'top', fontSize: 11, fill: '#94a3b8' }}
            />
          )}
          {portfolioDepletedYear && (
            <ReferenceLine
              x={portfolioDepletedYear}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: 'Portfolio depleted', position: 'insideTopLeft', fontSize: 10, fill: '#f59e0b' }}
            />
          )}
          <Line type="monotone" dataKey="buyNetWorth" name="Buy (total NW)" stroke={COLORS.buy} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="rentNetWorth" name="Rent (total NW)" stroke={COLORS.rent} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          {showPortfolioLine && (
            <Line type="monotone" dataKey="buyPortfolio" name="Buy (liquid portfolio)" stroke={COLORS.buy} strokeWidth={1.5} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Monthly cash flow comparison ────────────────────────────────────────────

function Row({ label, value, indent = false, bold = false, positive = false, negative = false, separator = false }) {
  const valueColor = positive ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-slate-700';
  return (
    <>
      {separator && <div className="border-t border-slate-200 my-1" />}
      <div className={`flex justify-between items-center py-0.5 ${indent ? 'pl-3' : ''}`}>
        <span className={`text-xs ${bold ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{label}</span>
        <span className={`text-xs font-medium ${bold ? 'font-semibold' : ''} ${valueColor}`}>{value}</span>
      </div>
    </>
  );
}

export function CashFlowCard({ buySnapshot, rentSnapshot, monthlyIncome, monthlyExpenses, annualSalary, marginalRate }) {
  const grossMonthly = annualSalary ? Math.round(annualSalary / 12) : null;
  const taxMonthly = annualSalary ? Math.round(annualSalary * marginalRate / 12) : null;
  const buySurplus = buySnapshot.monthlySurplus;
  const rentSurplus = rentSnapshot.monthlySurplus;
  const rentUtilities = rentSnapshot.monthlyHousingCost - rentSnapshot.currentYearMonthlyRent;
  const delta = buySnapshot.monthlyHousingCost - rentSnapshot.monthlyHousingCost;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 col-span-2">
      <h3 className="font-semibold text-slate-900 mb-1">Monthly Cash Flow (Year 1)</h3>
      <p className="text-xs text-slate-400 mb-4">Full income statement — where every dollar goes</p>

      <div className="grid grid-cols-2 gap-8">

        {/* ── Buy ── */}
        <div>
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">Buy</p>
          <div className="space-y-1">
            {grossMonthly && <Row label="Gross salary" value={`+${formatDollarFull(grossMonthly)}`} positive />}
            {taxMonthly   && <Row label="Income tax" value={`−${formatDollarFull(taxMonthly)}`} indent negative />}
            <Row label="Take-home income" value={`+${formatDollarFull(monthlyIncome)}`} bold positive separator={!!grossMonthly} />

            <Row label="Living expenses" value={`−${formatDollarFull(monthlyExpenses)}`} indent negative />
            <Row label="Mortgage" value={`−${formatDollarFull(buySnapshot.mortgagePaymentMonthly)}`} indent negative />
            <Row label="Property tax" value={`−${formatDollarFull(buySnapshot.propertyTaxMonthly)}`} indent negative />
            <Row label="Maintenance" value={`−${formatDollarFull(buySnapshot.maintenanceMonthly)}`} indent negative />
            <Row label="Insurance" value={`−${formatDollarFull(buySnapshot.insuranceMonthly)}`} indent negative />
            {buySnapshot.condoFeesMonthly > 0 && <Row label="Condo fees" value={`−${formatDollarFull(buySnapshot.condoFeesMonthly)}`} indent negative />}
            <Row label="Utilities" value={`−${formatDollarFull(buySnapshot.utilityMonthly)}`} indent negative />

            <Row separator bold
              label={buySurplus >= 0 ? 'Surplus → invested' : buySnapshot.portfolioInsolvent ? 'Shortfall → debt' : 'Shortfall → portfolio drawdown'}
              value={`${buySurplus >= 0 ? '+' : '−'}${formatDollarFull(Math.abs(buySurplus))}`}
              positive={buySurplus >= 0}
              negative={buySurplus < 0}
            />
          </div>
        </div>

        {/* ── Rent ── */}
        <div>
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">Rent</p>
          <div className="space-y-1">
            {grossMonthly && <Row label="Gross salary" value={`+${formatDollarFull(grossMonthly)}`} positive />}
            {taxMonthly   && <Row label="Income tax" value={`−${formatDollarFull(taxMonthly)}`} indent negative />}
            <Row label="Take-home income" value={`+${formatDollarFull(monthlyIncome)}`} bold positive separator={!!grossMonthly} />

            <Row label="Living expenses" value={`−${formatDollarFull(monthlyExpenses)}`} indent negative />
            <Row label="Rent" value={`−${formatDollarFull(rentSnapshot.currentYearMonthlyRent)}`} indent negative />
            <Row label="Utilities" value={`−${formatDollarFull(rentUtilities)}`} indent negative />

            <Row separator bold
              label={rentSurplus >= 0 ? 'Surplus → invested' : rentSnapshot.portfolioInsolvent ? 'Shortfall → debt' : 'Shortfall → portfolio drawdown'}
              value={`${rentSurplus >= 0 ? '+' : '−'}${formatDollarFull(Math.abs(rentSurplus))}`}
              positive={rentSurplus >= 0}
              negative={rentSurplus < 0}
            />
          </div>
        </div>
      </div>

      {delta !== 0 && (
        <p className="text-sm text-slate-500 mt-5 pt-4 border-t border-slate-100 text-center">
          Housing costs <span className="font-semibold text-slate-700">{formatDollarFull(Math.abs(delta))}/mo {delta > 0 ? 'more' : 'less'}</span> to buy than rent in Year 1
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

const CompositionTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const totalNW = d.buyNetWorth;
  const equity = d.buyEquity;
  const portfolio = d.buyPortfolio;
  const liquidPct = totalNW > 0 ? Math.round((Math.max(0, portfolio) / totalNW) * 100) : 0;
  const illiquidPct = totalNW > 0 ? Math.round((equity / totalNW) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm min-w-[200px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-slate-500">Total net worth</span>
        <span className="font-semibold">{formatDollarFull(totalNW)}</span>
      </div>
      <div className="border-t border-slate-100 mt-2 pt-2 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-indigo-500">Home equity (illiquid)</span>
          <span className="font-medium">{formatDollarFull(equity)} · {illiquidPct}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className={portfolio >= 0 ? 'text-violet-500' : 'text-red-500'}>
            {portfolio >= 0 ? 'Portfolio (liquid)' : 'Drawn from equity'}
          </span>
          <span className={`font-medium ${portfolio < 0 ? 'text-red-600' : ''}`}>
            {portfolio >= 0 ? formatDollarFull(portfolio) : `−${formatDollarFull(Math.abs(portfolio))}`} · {portfolio >= 0 ? `${liquidPct}%` : 'debt'}
          </span>
        </div>
      </div>
    </div>
  );
};

export function WealthCompositionChart({ chartData }) {
  const filtered = chartData.filter((_, i) => i % 2 === 1 || i === 0);
  const hasNegativePortfolio = filtered.some(d => d.buyPortfolio < 0);

  // Build data with positive equity, positive liquid portfolio, and negative debt as separate keys
  const compositionData = filtered.map(d => ({
    ...d,
    equityBar: d.buyEquity,
    liquidBar: Math.max(0, d.buyPortfolio),
    debtBar: Math.min(0, d.buyPortfolio), // negative value, renders below zero
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Wealth Composition (Buy)</h3>
      <p className="text-xs text-slate-400 mb-1">Total net worth = home equity + liquid portfolio</p>
      {hasNegativePortfolio && (
        <p className="text-xs text-amber-600 mb-3">
          Red segment = equity drawn to fund housing gap. Net worth already accounts for this.
        </p>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={compositionData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={70} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
          <Tooltip content={<CompositionTooltip />} />
          <Legend
            formatter={(value) => ({
              equityBar: 'Home equity (illiquid)',
              liquidBar: 'Portfolio (liquid)',
              debtBar: 'Drawn from equity (debt)',
            }[value] || value)}
          />
          <Bar dataKey="equityBar" name="equityBar" stackId="nw" fill={COLORS.equity}>
            <LabelList content={<BarLabel />} position="top" />
          </Bar>
          <Bar dataKey="liquidBar" name="liquidBar" stackId="nw" fill={COLORS.buy} radius={[4, 4, 0, 0]} />
          <Bar dataKey="debtBar" name="debtBar" stackId="nw" fill="#ef4444" radius={[0, 0, 4, 4]} />
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
