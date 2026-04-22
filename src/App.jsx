import React, { useState, useMemo } from 'react';
import { toronto } from './config/cities/toronto.js';
import { projectBuyScenario, projectRentScenario, findBreakEven, buildChartData } from './engine/networth.js';
import { BaseProfileInputs, BuyScenarioInputs, RentScenarioInputs } from './components/inputs/ScenarioInputs.jsx';
import { HeadlineCard, NetWorthChart, CashFlowCard, WealthCompositionChart, DetailTable, FIRECard, SensitivityTable } from './components/outputs/Results.jsx';
import { Commentary } from './components/outputs/Commentary.jsx';

const DEFAULT_PROFILE = {
  annualSalary:      150000,
  effectiveTaxRate:  0.33,                                         // for take-home
  monthlyIncome:     Math.round((150000 * (1 - 0.33)) / 12),
  monthlyExpenses:   3500,
  marginalRate:      0.43,                                         // for investment gains
  portfolioReturn:   0.07,
  horizonYears:      10,
  liquidAssets:      300000,
  incomeGrowthRate:  0.03,
  expenseGrowthRate: 0.02,
  withdrawalRate:    0.03,
};

const DEFAULT_BUY = {
  purchasePrice:       900000,
  downPaymentPct:      0.20,
  amortizationYears:   25,
  mortgageRate:        toronto.defaultMortgageRate,
  appreciationRate:    toronto.defaultAppreciation,
  condoFeesMonthly:    0,
  utilityBuyMonthly:   toronto.buyUtilitiesMonthly,
  renovationBudget:    0,
  renovationValueAddPct: 75,
  renovationSplit:     [{ year: 1, pct: 100 }],
  // Buying closing costs (editable, default mirrors toronto.js)
  legalFeesBuy:                  2000,
  titleInsurance:                350,
  homeInspection:                500,
  buyerAgentCommissionPct:       0.025,
  // Selling costs at exit (editable)
  listingAgentCommissionPct:     0.025,
  buyerAgentCommissionAtSalePct: 0.025,
  sellerLegalFees:               1500,
};

const DEFAULT_RENT = {
  monthlyRent:        3200,
  rentIncreaseRate:   toronto.defaultRentIncrease,
  utilityRentMonthly: toronto.rentUtilitiesMonthly,
};

const SENSITIVITY_RATES = [0.00, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08];

export default function App() {
  const [activeTab, setActiveTab] = useState('inputs');
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [buy, setBuy]         = useState(DEFAULT_BUY);
  const [rent, setRent]       = useState(DEFAULT_RENT);

  const params = useMemo(() => ({ ...profile, ...buy, ...rent }), [profile, buy, rent]);

  const buySnapshots  = useMemo(() => projectBuyScenario(params, toronto),  [params]);
  const rentSnapshots = useMemo(() => projectRentScenario(params, toronto), [params]);
  const chartData     = useMemo(() => buildChartData(buySnapshots, rentSnapshots), [buySnapshots, rentSnapshots]);
  const breakEvenYear = useMemo(() => findBreakEven(buySnapshots, rentSnapshots), [buySnapshots, rentSnapshots]);

  const buyFinal  = buySnapshots[buySnapshots.length - 1]?.totalNetWorth  ?? 0;
  const rentFinal = rentSnapshots[rentSnapshots.length - 1]?.totalNetWorth ?? 0;

  const buyFireYear  = useMemo(() => buySnapshots.find(s => s.fireAchieved)?.year  ?? null, [buySnapshots]);
  const rentFireYear = useMemo(() => rentSnapshots.find(s => s.fireAchieved)?.year ?? null, [rentSnapshots]);

  const sensitivityData = useMemo(() => SENSITIVITY_RATES.map(appreciationRate => {
    const p = { ...params, appreciationRate };
    const bSnaps = projectBuyScenario(p, toronto);
    const rSnaps = projectRentScenario(p, toronto);
    const bFinal = bSnaps[bSnaps.length - 1]?.totalNetWorth ?? 0;
    const rFinal = rSnaps[rSnaps.length - 1]?.totalNetWorth ?? 0;
    return {
      appreciationRate,
      buyFinal: bFinal,
      rentFinal: rFinal,
      delta: bFinal - rFinal,
      buyWins: bFinal > rFinal,
      breakEvenYear: findBreakEven(bSnaps, rSnaps),
    };
  }), [params]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Rent vs. Buy</h1>
            <p className="text-xs text-slate-400">Toronto · net worth planner</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tax modelling is simplified · Not financial advice
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Tab bar */}
        <div className="flex gap-1 mb-8 bg-slate-100 rounded-xl p-1 w-fit">
          {[
            { id: 'inputs',   label: 'Inputs'   },
            { id: 'analysis', label: 'Analysis' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Inputs tab ── */}
        {activeTab === 'inputs' && (
          <div className="max-w-[520px] flex flex-col gap-5">
            <BaseProfileInputs profile={profile} onChange={setProfile} />
            <BuyScenarioInputs buy={buy} onChange={setBuy} cityConfig={toronto} />
            <RentScenarioInputs rent={rent} onChange={setRent} cityConfig={toronto} />

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-2">Toronto Notes</p>
              <ul className="space-y-1">
                {toronto.notes.map((note, i) => (
                  <li key={i} className="text-xs text-blue-700 flex gap-1.5">
                    <span className="mt-0.5 shrink-0">·</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setActiveTab('analysis')}
              className="self-start flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              View Analysis →
            </button>
          </div>
        )}

        {/* ── Analysis tab ── */}
        {activeTab === 'analysis' && (
          <div className="flex flex-col gap-5">
            <HeadlineCard
              buyFinal={buyFinal}
              rentFinal={rentFinal}
              breakEvenYear={breakEvenYear}
              horizonYears={profile.horizonYears}
              buySnapshots={buySnapshots}
              rentSnapshots={rentSnapshots}
            />

            <NetWorthChart chartData={chartData} breakEvenYear={breakEvenYear} />

            <CashFlowCard
              buySnapshot={buySnapshots[0]}
              rentSnapshot={rentSnapshots[0]}
              monthlyIncome={profile.monthlyIncome}
              monthlyExpenses={profile.monthlyExpenses}
              annualSalary={profile.annualSalary}
              effectiveTaxRate={profile.effectiveTaxRate}
            />

            <FIRECard
              buySnapshots={buySnapshots}
              rentSnapshots={rentSnapshots}
              buyFireYear={buyFireYear}
              rentFireYear={rentFireYear}
              horizonYears={profile.horizonYears}
              withdrawalRate={profile.withdrawalRate}
            />

            <WealthCompositionChart chartData={chartData} />

            <SensitivityTable
              sensitivityData={sensitivityData}
              currentAppreciation={buy.appreciationRate}
              horizonYears={profile.horizonYears}
            />

            <Commentary
              params={{ profile, buy, rent }}
              buySnapshots={buySnapshots}
              rentSnapshots={rentSnapshots}
              breakEvenYear={breakEvenYear}
            />

            <DetailTable buySnapshots={buySnapshots} rentSnapshots={rentSnapshots} />
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Built for Toronto homebuyers · Tax estimates simplified · Always consult a financial advisor for major decisions
      </footer>
    </div>
  );
}
