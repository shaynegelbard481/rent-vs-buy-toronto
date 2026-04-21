import React, { useState } from 'react';
import { InputField, SelectField, SliderField, SectionCard, Collapsible } from './InputField.jsx';
import { toronto } from '../../config/cities/toronto.js';

// Compute blended effective capital gains rate from account mix
function blendedRate(tfsa, rrsp, taxable, marginalRate) {
  const total = tfsa + rrsp + taxable;
  if (total === 0) return marginalRate;
  // TFSA: 0% effective. RRSP: full marginal on withdrawal. Taxable: 50% inclusion.
  const effectiveTaxable = taxable * (0.5 * marginalRate);
  const effectiveRRSP = rrsp * marginalRate;
  return (effectiveTaxable + effectiveRRSP) / total;
}

export function BaseProfileInputs({ profile, onChange }) {
  const [refined, setRefined] = useState(false);
  const set = (key) => (val) => onChange({ ...profile, [key]: val });

  // Derive monthly take-home from gross annual salary
  const monthlyTakeHome = profile.annualSalary
    ? Math.round((profile.annualSalary * (1 - profile.marginalRate)) / 12)
    : profile.monthlyIncome;

  // Blended rate from refined inputs
  const computedBlendedRate = refined
    ? blendedRate(profile.tfsaBalance || 0, profile.rrspBalance || 0, profile.taxableBalance || 0, profile.marginalRate)
    : profile.marginalRate;

  const totalRefined = (profile.tfsaBalance || 0) + (profile.rrspBalance || 0) + (profile.taxableBalance || 0);

  function handleRefinedToggle(on) {
    setRefined(on);
    if (on) {
      // Seed refined fields from current liquidAssets (split evenly as starting point)
      const third = Math.round(profile.liquidAssets / 3);
      onChange({
        ...profile,
        tfsaBalance: third,
        rrspBalance: third,
        taxableBalance: profile.liquidAssets - third * 2,
        effectiveRate: computedBlendedRate,
      });
    } else {
      onChange({ ...profile, effectiveRate: profile.marginalRate });
    }
  }

  // Keep liquidAssets in sync with refined totals
  function setRefinedField(key, val) {
    const next = { ...profile, [key]: val };
    next.liquidAssets = (next.tfsaBalance || 0) + (next.rrspBalance || 0) + (next.taxableBalance || 0);
    next.effectiveRate = blendedRate(next.tfsaBalance || 0, next.rrspBalance || 0, next.taxableBalance || 0, next.marginalRate);
    onChange(next);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="border-l-4 border-l-purple-500 px-6 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-base">Your Financial Profile</h3>
        <p className="text-xs text-slate-500 mt-0.5">Starting point for both scenarios</p>
      </div>
      <div className="px-6 py-5 grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Annual salary → derive take-home */}
        <InputField
          label="Annual gross salary"
          value={profile.annualSalary}
          onChange={val => onChange({ ...profile, annualSalary: val, monthlyIncome: Math.round((val * (1 - profile.marginalRate)) / 12) })}
          prefix="$"
          helper={profile.annualSalary ? `≈ $${monthlyTakeHome.toLocaleString()}/mo after tax at ${Math.round(profile.marginalRate * 100)}%` : 'Used to derive monthly take-home'}
        />

        <InputField
          label="Monthly non-housing expenses"
          value={profile.monthlyExpenses}
          onChange={set('monthlyExpenses')}
          prefix="$"
          helper="Food, transport, lifestyle — excluding housing"
        />

        <InputField
          label="Marginal tax rate"
          value={profile.marginalRate * 100}
          onChange={v => {
            const rate = v / 100;
            const nextIncome = profile.annualSalary
              ? Math.round((profile.annualSalary * (1 - rate)) / 12)
              : profile.monthlyIncome;
            onChange({ ...profile, marginalRate: rate, monthlyIncome: nextIncome });
          }}
          suffix="%"
          step={1}
          min={20}
          max={55}
          decimals={0}
          helper="Applied to derive take-home and tax portfolio gains"
        />

        <InputField
          label="Expected portfolio return"
          value={profile.portfolioReturn * 100}
          onChange={v => set('portfolioReturn')(v / 100)}
          suffix="%"
          step={0.5}
          min={1}
          max={15}
          decimals={1}
          helper="Long-run annual return on invested capital"
        />

        {/* Net worth — simple vs refined toggle */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Net worth / liquid assets</label>
            <button
              onClick={() => handleRefinedToggle(!refined)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              {refined ? '← Simplify' : 'Refine by account type →'}
            </button>
          </div>

          {!refined ? (
            <InputField
              label=""
              value={profile.liquidAssets}
              onChange={set('liquidAssets')}
              prefix="$"
              helper="TFSA + RRSP + taxable accounts combined"
            />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <InputField
                label="TFSA"
                value={profile.tfsaBalance || 0}
                onChange={v => setRefinedField('tfsaBalance', v)}
                prefix="$"
                helper="Tax-free growth"
              />
              <InputField
                label="RRSP"
                value={profile.rrspBalance || 0}
                onChange={v => setRefinedField('rrspBalance', v)}
                prefix="$"
                helper="Tax-deferred"
              />
              <InputField
                label="Taxable"
                value={profile.taxableBalance || 0}
                onChange={v => setRefinedField('taxableBalance', v)}
                prefix="$"
                helper="Capital gains apply"
              />
              <div className="col-span-3 bg-slate-50 rounded-lg px-4 py-2.5 flex justify-between items-center text-sm">
                <span className="text-slate-500">Total liquid assets</span>
                <span className="font-semibold text-slate-800">${totalRefined.toLocaleString()}</span>
              </div>
              <div className="col-span-3 bg-indigo-50 rounded-lg px-4 py-2.5 flex justify-between items-center text-sm">
                <span className="text-indigo-700">Computed blended tax rate</span>
                <span className="font-semibold text-indigo-700">{(computedBlendedRate * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>

        <SelectField
          label="Time horizon"
          value={profile.horizonYears}
          onChange={v => set('horizonYears')(parseInt(v))}
          options={[5, 7, 10, 15, 20].map(y => ({ value: y, label: `${y} years` }))}
        />
      </div>
    </div>
  );
}

export function BuyScenarioInputs({ buy, onChange, cityConfig = toronto }) {
  const set = (key) => (val) => onChange({ ...buy, [key]: val });

  const ltt = cityConfig.landTransferTax(buy.purchasePrice);
  const lttBreakdown = cityConfig.landTransferTaxBreakdown(buy.purchasePrice);
  const cmhc = cityConfig.cmhcInsurance(buy.purchasePrice, buy.downPaymentPct);
  const buyerCommission = Math.round(cityConfig.buyerAgentCommission * buy.purchasePrice);
  const closingTotal = ltt + cityConfig.legalFeesBuy + cityConfig.titleInsurance + cityConfig.homeInspection + buyerCommission;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Buy Scenario" subtitle="Property & mortgage details" accent="blue">
        <InputField
          label="Purchase price"
          value={buy.purchasePrice}
          onChange={set('purchasePrice')}
          prefix="$"
        />
        <SliderField
          label="Down payment"
          value={buy.downPaymentPct * 100}
          onChange={v => set('downPaymentPct')(v / 100)}
          min={5}
          max={50}
          step={1}
          format={v => `${v}% — $${Math.round(buy.purchasePrice * v / 100).toLocaleString()}`}
          helper={buy.downPaymentPct < 0.2 ? `CMHC insurance: $${cmhc.toLocaleString()} added to mortgage` : 'No CMHC required (≥20% down)'}
        />
        <SelectField
          label="Amortization"
          value={buy.amortizationYears}
          onChange={v => set('amortizationYears')(parseInt(v))}
          options={[
            { value: 25, label: '25 years' },
            { value: 30, label: '30 years (first-time buyers, new builds)' },
          ]}
        />
        <InputField
          label="Mortgage interest rate"
          value={buy.mortgageRate * 100}
          onChange={v => set('mortgageRate')(v / 100)}
          suffix="%"
          step={0.05}
          min={1}
          max={12}
          decimals={2}
          helper={`5yr fixed ≈ ${(cityConfig.defaultMortgageRate * 100).toFixed(2)}% (Spring 2025)`}
        />
        <InputField
          label="Annual home appreciation"
          value={buy.appreciationRate * 100}
          onChange={v => set('appreciationRate')(v / 100)}
          suffix="%"
          step={0.5}
          min={-2}
          max={12}
          decimals={1}
          helper={`Toronto long-run avg ≈ ${(cityConfig.defaultAppreciation * 100).toFixed(0)}%`}
        />
        <InputField
          label="Monthly condo fees"
          value={buy.condoFeesMonthly}
          onChange={set('condoFeesMonthly')}
          prefix="$"
          helper="Enter $0 for freehold"
        />
        <InputField
          label="Monthly utilities (buy)"
          value={buy.utilityBuyMonthly}
          onChange={set('utilityBuyMonthly')}
          prefix="$"
          helper={`Heat, hydro, water — est. $${cityConfig.buyUtilitiesMonthly}/mo`}
        />
      </SectionCard>

      {/* Closing costs — transparent breakdown, note about editability */}
      <Collapsible
        title="Closing Costs"
        subtitle={`Est. total: $${closingTotal.toLocaleString()} — click to review`}
        defaultOpen={false}
      >
        <div className="col-span-2 bg-slate-50 rounded-xl p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Provincial land transfer tax</span>
            <span className="font-medium">${lttBreakdown.provincial.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Toronto municipal land transfer tax</span>
            <span className="font-medium">${lttBreakdown.municipal.toLocaleString()}</span>
          </div>
          {cmhc > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>CMHC insurance (added to mortgage)</span>
              <span className="font-medium">${cmhc.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Buyer agent commission (2.5%)</span>
            <span className="font-medium">${buyerCommission.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Legal fees</span>
            <span className="font-medium">${cityConfig.legalFeesBuy.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Title insurance</span>
            <span className="font-medium">${cityConfig.titleInsurance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Home inspection</span>
            <span className="font-medium">${cityConfig.homeInspection.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
            <span>Total closing costs</span>
            <span>${closingTotal.toLocaleString()}</span>
          </div>
        </div>
        <p className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Individual line items will be editable in v2.0. Values are calculated from Toronto 2024 rates.
        </p>
        <p className="col-span-2 text-xs text-slate-400">
          Selling costs (~5% of sale price) are also deducted from equity at exit when calculating your net proceeds.
        </p>
      </Collapsible>

      {/* Renovation module — multi-year */}
      <Collapsible
        title="Renovation / Value-Add"
        subtitle="Optional: model a renovation and its expected equity uplift"
        defaultOpen={false}
      >
        <InputField
          label="Total renovation budget"
          value={buy.renovationBudget}
          onChange={set('renovationBudget')}
          prefix="$"
          helper="Total cost across all years"
        />
        <InputField
          label="Expected value-add"
          value={buy.renovationValueAddPct}
          onChange={set('renovationValueAddPct')}
          suffix="% of budget"
          step={5}
          min={0}
          max={150}
          decimals={0}
          helper="Kitchen ≈ 70–85%, bathroom ≈ 60–70%"
        />

        <div className="col-span-2">
          <p className="text-sm font-medium text-slate-700 mb-2">Budget split across years</p>
          <div className="space-y-2">
            {(buy.renovationSplit || [{ year: 1, pct: 100 }]).map((row, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_32px] gap-2 items-center">
                <SelectField
                  label=""
                  value={row.year}
                  onChange={v => {
                    const split = [...(buy.renovationSplit || [{ year: 1, pct: 100 }])];
                    split[i] = { ...split[i], year: parseInt(v) };
                    set('renovationSplit')(split);
                  }}
                  options={[1,2,3,4,5].map(y => ({ value: y, label: `Yr ${y}` }))}
                />
                <InputField
                  label=""
                  value={row.pct}
                  onChange={v => {
                    const split = [...(buy.renovationSplit || [{ year: 1, pct: 100 }])];
                    split[i] = { ...split[i], pct: v };
                    set('renovationSplit')(split);
                  }}
                  suffix="%"
                  min={0}
                  max={100}
                  decimals={0}
                />
                {(buy.renovationSplit || []).length > 1 && (
                  <button
                    onClick={() => {
                      const split = (buy.renovationSplit || []).filter((_, j) => j !== i);
                      set('renovationSplit')(split);
                    }}
                    className="text-slate-400 hover:text-red-500 text-lg leading-none mt-1"
                  >×</button>
                )}
              </div>
            ))}
            {(buy.renovationSplit || [{ year: 1, pct: 100 }]).length < 3 && (
              <button
                onClick={() => {
                  const split = [...(buy.renovationSplit || [{ year: 1, pct: 100 }]), { year: 2, pct: 0 }];
                  set('renovationSplit')(split);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Add year
              </button>
            )}
          </div>
          {buy.renovationBudget > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              Total allocated: {(buy.renovationSplit || [{ year: 1, pct: 100 }]).reduce((s, r) => s + r.pct, 0)}%
              {(buy.renovationSplit || [{ year: 1, pct: 100 }]).reduce((s, r) => s + r.pct, 0) !== 100 &&
                <span className="text-amber-600"> — should sum to 100%</span>}
            </p>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

export function RentScenarioInputs({ rent, onChange, cityConfig = toronto }) {
  const set = (key) => (val) => onChange({ ...rent, [key]: val });
  return (
    <SectionCard title="Rent Scenario" subtitle="What if you kept renting instead?" accent="green">
      <InputField
        label="Monthly rent"
        value={rent.monthlyRent}
        onChange={set('monthlyRent')}
        prefix="$"
      />
      <InputField
        label="Annual rent increase"
        value={rent.rentIncreaseRate * 100}
        onChange={v => set('rentIncreaseRate')(v / 100)}
        suffix="%"
        step={0.5}
        min={0}
        max={10}
        decimals={1}
        helper={`Ontario rent control guideline ≈ ${(cityConfig.defaultRentIncrease * 100).toFixed(1)}%`}
      />
      <InputField
        label="Monthly utilities (rent)"
        value={rent.utilityRentMonthly}
        onChange={set('utilityRentMonthly')}
        prefix="$"
        helper={`Often partially included — est. $${cityConfig.rentUtilitiesMonthly}/mo`}
      />
    </SectionCard>
  );
}
