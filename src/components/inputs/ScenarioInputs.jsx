import React from 'react';
import { InputField, SelectField, SliderField, SectionCard, Collapsible } from './InputField.jsx';
import { toronto } from '../../config/cities/toronto.js';

const fmt = {
  pct: v => `${(v * 100).toFixed(1)}%`,
  pctInt: v => `${v}%`,
  dollar: v => `$${Number(v).toLocaleString()}`,
};

export function BaseProfileInputs({ profile, onChange }) {
  const set = (key) => (val) => onChange({ ...profile, [key]: val });
  return (
    <SectionCard title="Your Financial Profile" subtitle="Starting point for both scenarios" accent="purple">
      <InputField
        label="Total liquid assets"
        value={profile.liquidAssets}
        onChange={set('liquidAssets')}
        prefix="$"
        helper="TFSA + RRSP + taxable accounts combined"
      />
      <InputField
        label="Monthly take-home income"
        value={profile.monthlyIncome}
        onChange={set('monthlyIncome')}
        prefix="$"
        helper="After-tax income per month"
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
        onChange={v => set('marginalRate')(v / 100)}
        suffix="%"
        step={1}
        min={20}
        max={55}
        helper="Applied to investment portfolio capital gains (50% inclusion)"
      />
      <SelectField
        label="Investment account type"
        value={profile.accountType}
        onChange={set('accountType')}
        options={[
          { value: 'tfsa', label: 'TFSA (tax-free growth)' },
          { value: 'rrsp', label: 'RRSP (tax-deferred)' },
          { value: 'taxable', label: 'Taxable account' },
        ]}
        helper="Determines after-tax portfolio returns"
      />
      <InputField
        label="Expected portfolio return"
        value={profile.portfolioReturn * 100}
        onChange={v => set('portfolioReturn')(v / 100)}
        suffix="%"
        step={0.5}
        min={1}
        max={15}
        helper="Long-run annual return on invested capital"
      />
      <SelectField
        label="Time horizon"
        value={profile.horizonYears}
        onChange={v => set('horizonYears')(parseInt(v))}
        options={[5, 7, 10, 15, 20].map(y => ({ value: y, label: `${y} years` }))}
      />
    </SectionCard>
  );
}

export function BuyScenarioInputs({ buy, onChange, cityConfig = toronto }) {
  const set = (key) => (val) => onChange({ ...buy, [key]: val });

  const ltt = cityConfig.landTransferTax(buy.purchasePrice);
  const lttBreakdown = cityConfig.landTransferTaxBreakdown(buy.purchasePrice);
  const cmhc = cityConfig.cmhcInsurance(buy.purchasePrice, buy.downPaymentPct);
  const loanAmount = buy.purchasePrice * (1 - buy.downPaymentPct) + cmhc;
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

      {/* Closing costs — shown transparently, editable */}
      <Collapsible
        title="Closing Costs"
        subtitle={`Est. total: $${closingTotal.toLocaleString()} — click to review & edit`}
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
        <p className="col-span-2 text-xs text-slate-400">
          Selling costs (~5% of sale price) are also deducted from equity at exit when calculating your net proceeds.
        </p>
      </Collapsible>

      {/* Renovation module */}
      <Collapsible
        title="Renovation / Value-Add"
        subtitle="Optional: model a renovation and its expected equity uplift"
        defaultOpen={false}
      >
        <InputField
          label="Renovation budget"
          value={buy.renovationBudget}
          onChange={set('renovationBudget')}
          prefix="$"
          helper="Upfront cost in the year of renovation"
        />
        <InputField
          label="Expected value-add"
          value={buy.renovationValueAddPct}
          onChange={set('renovationValueAddPct')}
          suffix="% of budget"
          step={5}
          min={0}
          max={150}
          helper="Kitchen reno ≈ 70–85%, bathroom ≈ 60–70%"
        />
        <SelectField
          label="Renovation year"
          value={buy.renovationYear}
          onChange={v => set('renovationYear')(parseInt(v))}
          options={[1,2,3,4,5].map(y => ({ value: y, label: `Year ${y}` }))}
        />
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
