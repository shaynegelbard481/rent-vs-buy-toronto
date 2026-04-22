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

export function CashFlowCard({ buySnapshot, rentSnapshot, monthlyIncome, monthlyExpenses, annualSalary, effectiveTaxRate }) {
  const grossMonthly = annualSalary ? Math.round(annualSalary / 12) : null;
  const taxMonthly = annualSalary ? Math.round(annualSalary * (effectiveTaxRate ?? 0.33) / 12) : null;
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

// ─── Wealth composition chart ─────────────────────────────────────────────────

const CompositionTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const totalNW = d.buyNetWorth;
  const liquid = Math.max(0, d.buyPortfolio);
  const illiquid = Math.max(0, totalNW - liquid);
  const liquidPct = totalNW > 0 ? Math.round((liquid / totalNW) * 100) : 0;
  const illiquidPct = totalNW > 0 ? Math.round((illiquid / totalNW) * 100) : 0;
  const hasDebt = d.buyPortfolio < 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-sm min-w-[210px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      <div className="flex justify-between gap-4 mb-2">
        <span className="text-slate-500">Total net worth</span>
        <span className="font-semibold">{formatDollarFull(totalNW)}</span>
      </div>
      <div className="border-t border-slate-100 pt-2 space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-indigo-400">Home equity (illiquid)</span>
          <span className="font-medium">{formatDollarFull(illiquid)} · {illiquidPct}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-violet-500">Portfolio (liquid)</span>
          <span className="font-medium">{formatDollarFull(liquid)} · {liquidPct}%</span>
        </div>
        {hasDebt && (
          <p className="text-xs text-amber-600 pt-1">
            Housing shortfall of {formatDollarFull(Math.abs(d.buyPortfolio))} is offset against equity.
          </p>
        )}
      </div>
    </div>
  );
};

export function WealthCompositionChart({ chartData }) {
  const filtered = chartData.filter((_, i) => i % 2 === 1 || i === 0);
  const hasDebt = filtered.some(d => d.buyPortfolio < 0);

  // Bar height = total net worth. Split: liquid portfolio on top, illiquid equity on bottom.
  // When portfolio is negative, it reduces the illiquid bar (total NW < gross equity).
  const compositionData = filtered.map((d, i) => {
    const liquid = Math.max(0, d.buyPortfolio);
    const illiquid = Math.max(0, d.buyNetWorth - liquid);
    return { ...d, illiquidBar: illiquid, liquidBar: liquid };
  });

  // Show label at top of whichever bar is the topmost in the stack
  const makeTopLabel = (showWhenLiquid) => ({ x, y, width, index }) => {
    const d = compositionData[index];
    if (!d) return null;
    const isLiquidTop = d.liquidBar > 0;
    if (showWhenLiquid !== isLiquidTop) return null;
    const nw = d.buyNetWorth;
    if (!nw || nw < 50000) return null;
    return (
      <text x={x + width / 2} y={y - 5} fill="#475569" fontSize={10} textAnchor="middle">
        {formatDollar(nw)}
      </text>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Wealth Composition (Buy)</h3>
      <p className="text-xs text-slate-400 mb-1">Bar height = total net worth · split into liquid vs. illiquid</p>
      {hasDebt && (
        <p className="text-xs text-amber-600 mb-3">
          Housing shortfall reduces liquid portfolio — bars show net worth after offset.
        </p>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={compositionData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} width={70} />
          <Tooltip content={<CompositionTooltip />} />
          <Legend
            formatter={(value) => ({ illiquidBar: 'Home equity (illiquid)', liquidBar: 'Portfolio (liquid)' }[value] || value)}
          />
          <Bar dataKey="illiquidBar" name="illiquidBar" stackId="nw" fill={COLORS.equity} radius={[4, 4, 0, 0]}>
            <LabelList content={makeTopLabel(false)} position="top" />
          </Bar>
          <Bar dataKey="liquidBar" name="liquidBar" stackId="nw" fill={COLORS.buy} radius={[4, 4, 0, 0]}>
            <LabelList content={makeTopLabel(true)} position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── FIRE card ────────────────────────────────────────────────────────────────

export function FIRECard({ buySnapshots, rentSnapshots, buyFireYear, rentFireYear, horizonYears, withdrawalRate }) {
  const buyFinal  = buySnapshots[buySnapshots.length - 1];
  const rentFinal = rentSnapshots[rentSnapshots.length - 1];

  if (!buyFinal || !rentFinal) return null;

  const fmt = (v) => v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`;

  function ScenarioFIRE({ label, snapshot, fireYear, color }) {
    const pct      = Math.round((snapshot.firePct ?? 0) * 100);
    const achieved = snapshot.fireAchieved;
    return (
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${color}`}>{label}</p>

        {/* FIRE status badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
          achieved
            ? 'bg-emerald-100 text-emerald-700'
            : fireYear === null
              ? 'bg-slate-100 text-slate-500'
              : 'bg-amber-100 text-amber-700'
        }`}>
          {achieved
            ? `🔥 FIRE at Year ${fireYear}`
            : fireYear
              ? `🔥 FIRE at Year ${fireYear}`
              : `Not in ${horizonYears}-yr horizon`}
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>FIRE progress at Yr {horizonYears}</span>
            <span className={pct >= 100 ? 'text-emerald-600 font-semibold' : ''}>{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-slate-300'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>

        {/* Numbers */}
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Investable at Yr {horizonYears}</span>
            <span className="font-medium">{fmt(snapshot.fireInvestable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Safe withdrawal ({(withdrawalRate * 100).toFixed(0)}%/yr)</span>
            <span className="font-medium">{fmt(snapshot.annualSafeWithdrawal)}/yr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Annual living spend at Yr {horizonYears}</span>
            <span className="font-medium">{fmt(snapshot.fireAnnualSpend)}/yr</span>
          </div>
          {!achieved && (snapshot.fireAnnualSpend ?? 0) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Gap (need {fmt((snapshot.fireAnnualSpend ?? 0) / withdrawalRate)} invested)</span>
              <span className="font-medium">–{fmt((snapshot.fireAnnualSpend ?? 0) - snapshot.annualSafeWithdrawal)}/yr</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔥</span>
        <h3 className="font-semibold text-slate-900">FIRE Analysis</h3>
      </div>
      <p className="text-xs text-slate-400 mb-1">
        Each year asks: if you sold your home today, could you retire?
        Buy scenario adds net sale proceeds to investable portfolio. Spend = living expenses only (housing resolved).
      </p>
      <p className="text-xs text-amber-600 mb-5">
        Note: if you hold RRSP balances, early withdrawal attracts full income tax — FIRE may require additional planning.
      </p>
      <div className="flex gap-6 divide-x divide-slate-100">
        <ScenarioFIRE label="Buy" snapshot={buyFinal}  fireYear={buyFireYear}  color="text-indigo-600" />
        <div className="pl-6 w-px" />
        <ScenarioFIRE label="Rent" snapshot={rentFinal} fireYear={rentFireYear} color="text-emerald-600" />
      </div>
    </div>
  );
}

// ─── Sensitivity table ────────────────────────────────────────────────────────

export function SensitivityTable({ sensitivityData, currentAppreciation, horizonYears }) {
  const fmt = (v) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? '–' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${Math.round(abs / 1_000)}K`;
    return `${sign}$${Math.round(abs)}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-semibold text-slate-900 mb-1">Appreciation Sensitivity</h3>
      <p className="text-xs text-slate-400 mb-4">
        How the buy vs. rent outcome shifts at different home appreciation rates — all other inputs unchanged.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 pr-3 text-slate-500 font-medium">Appreciation</th>
              <th className="text-right py-2 px-2 text-indigo-500 font-medium">Buy NW</th>
              <th className="text-right py-2 px-2 text-emerald-500 font-medium">Rent NW</th>
              <th className="text-right py-2 px-2 text-slate-500 font-medium">Winner</th>
              <th className="text-right py-2 pl-2 text-slate-500 font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {sensitivityData.map((row, i) => {
              const isCurrent = Math.abs(row.appreciationRate - currentAppreciation) < 0.001;
              return (
                <tr
                  key={i}
                  className={`border-b border-slate-50 ${isCurrent ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  <td className="py-2 pr-3 font-medium">
                    {(row.appreciationRate * 100).toFixed(0)}%
                    {isCurrent && <span className="ml-1.5 text-indigo-500 text-[10px]">← current</span>}
                  </td>
                  <td className="py-2 px-2 text-right font-medium text-indigo-600">{fmt(row.buyFinal)}</td>
                  <td className="py-2 px-2 text-right font-medium text-emerald-600">{fmt(row.rentFinal)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${row.buyWins ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {row.buyWins ? 'Buy' : 'Rent'}
                    </span>
                  </td>
                  <td className={`py-2 pl-2 text-right font-medium ${row.buyWins ? 'text-indigo-600' : 'text-emerald-600'}`}>
                    {fmt(Math.abs(row.delta))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
