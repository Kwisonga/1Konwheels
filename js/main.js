document.addEventListener('DOMContentLoaded', function() {
    // --- GLOBAL VARIABLES ---
    let USD_RWF_EXCHANGE_RATE = 1445; // Fallback rate
    const API_URL = 'https://car-price-api.umugabedr.workers.dev';
    let valueAsNew = 0;

    // --- DOM ELEMENTS ---
    const makerSelectEl = document.getElementById('car-maker');
    const yearSelectEl = document.getElementById('manufacturing-year');
    const modelSelectEl = document.getElementById('car-model');
    const specSelectEl = document.getElementById('car-spec');
    const exchangeRateDisplay = document.getElementById('exchange-rate-display');
    const rraPriceDisplay = document.getElementById('rra-price-display');
    const engineInput = document.getElementById('engine-capacity');
    const freightInput = document.getElementById('freight-cost');
    const insuranceInput = document.getElementById('insurance-cost');
    const fuelTypeSelect = document.getElementById('fuel-type');
    const utilityTypeSelect = document.getElementById('utility-type');
    const calculateBtn = document.getElementById('calculate-btn');
    const recalculateBtn = document.getElementById('recalculate-btn');
    const formDiv = document.getElementById('calculator-form');
    const resultsDiv = document.getElementById('results');
    const loaderDiv = document.getElementById('loader');
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // --- CHOICES.JS INSTANCES ---
    const makerChoices = new Choices(makerSelectEl, { searchResultLimit: 15, itemSelectText: 'Select' });
    const yearChoices = new Choices(yearSelectEl, { searchResultLimit: 15, itemSelectText: 'Select' });
    const modelChoices = new Choices(modelSelectEl, { searchResultLimit: 15, itemSelectText: 'Select' });
    const specChoices = new Choices(specSelectEl, { searchResultLimit: 15, itemSelectText: 'Select' });
    
    // --- DATA HANDLING AND UI POPULATION ---

    /**
     * Fetches and caches the USD to RWF exchange rate.
     */
    async function getExchangeRate() {
        const cacheKey = 'exchangeRateCache';
        const cachedData = JSON.parse(localStorage.getItem(cacheKey));
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        if (cachedData && cachedData.date === today) {
            USD_RWF_EXCHANGE_RATE = cachedData.rate;
            updateExchangeRateDisplay(cachedData.rate, 'cached');
            return;
        }

        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.json();
            const rate = data.rates.RWF;
            
            if (rate) {
                USD_RWF_EXCHANGE_RATE = rate;
                localStorage.setItem(cacheKey, JSON.stringify({ rate: rate, date: today }));
                updateExchangeRateDisplay(rate, 'live');
            } else {
                throw new Error('RWF rate not found in API response.');
            }
        } catch (error) {
            console.error("Failed to fetch live exchange rate:", error);
            if(cachedData) {
                 USD_RWF_EXCHANGE_RATE = cachedData.rate;
                 updateExchangeRateDisplay(cachedData.rate, 'fallback');
            } else {
                 updateExchangeRateDisplay(USD_RWF_EXCHANGE_RATE, 'default');
            }
        }
    }
    
    function updateExchangeRateDisplay(rate, status) {
        let statusText = '';
        switch(status) {
            case 'live': statusText = '(Live)'; break;
            case 'cached': statusText = '(Cached Today)'; break;
            case 'fallback': statusText = '(Using Older Cache)'; break;
            case 'default': statusText = '(Using Default)'; break;
        }
        exchangeRateDisplay.innerHTML = `<p class="text-sm font-medium text-blue-700">1 USD = ${parseFloat(rate).toFixed(2)} RWF <span class="font-normal text-gray-500">${statusText}</span></p>`;
    }

    async function fetchAndSetChoices(url, choicesInstance, prompt) {
        try {
            choicesInstance.disable();
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
            const data = await response.json();
            
            const filteredData = data.filter(value => value !== null && value !== undefined && value.toString().trim() !== '');
            const choicesData = filteredData.map(value => ({ value: value, label: value }));
            
            choicesInstance.clearStore();
            
            if (choicesInstance === yearChoices) {
                choicesData.sort((a, b) => b.label - a.label);
            } else {
                choicesData.sort((a, b) => a.label.localeCompare(b.label));
            }

            choicesInstance.setChoices(
                [{ value: '', label: prompt, selected: true, disabled: true }, ...choicesData],
                'value',
                'label',
                false
            );
            choicesInstance.enable();
        } catch (error) {
            displayError(`Failed to load options from ${url}. Error: ${error.message}`);
            choicesInstance.clearStore();
            choicesInstance.setChoices([{ value: '', label: 'Error Loading', selected: true, disabled: true }], 'value', 'label', false);
        }
    }

    async function initializeBrands() {
        yearChoices.disable(); modelChoices.disable(); specChoices.disable();
        await fetchAndSetChoices(`${API_URL}/brands`, makerChoices, 'Select Maker');
    }

    function updatePriceDisplay(price) {
         valueAsNew = price;
         rraPriceDisplay.textContent = formatUSD(price);
    }

    // --- UTILITY AND VALIDATION ---
    
    function formatUSD(amount) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }

    function formatRWF(amount) {
        return new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', maximumFractionDigits: 0 }).format(amount);
    }
    
    function validateInputs() {
        if (!makerChoices.getValue(true)) return "Please select a car maker.";
        if (!yearChoices.getValue(true)) return "Please select a manufacturing year.";
        if (!modelChoices.getValue(true)) return "Please select a car model.";
        if (!specChoices.getValue(true)) return "Please select specifications.";
        if (!fuelTypeSelect.value) return "Please select a fuel type.";
        
        const isElectric = fuelTypeSelect.value === 'Electric';
        if (!isElectric && !utilityTypeSelect.value) {
             return "Please select a vehicle utility type.";
        }

        const engineCC = parseInt(engineInput.value);
        if (!isElectric && (!engineCC || engineCC <= 0)) {
             return "Please enter a valid engine capacity for Fuel/Hybrid cars.";
        }

        if (isNaN(parseFloat(freightInput.value)) || parseFloat(freightInput.value) < 0) return "Please enter a valid freight cost.";
        if (isNaN(parseFloat(insuranceInput.value)) || parseFloat(insuranceInput.value) < 0) return "Please enter a valid insurance cost.";

        return null;
    }
    
    function displayError(message) {
        if (message) {
            errorText.textContent = message;
            errorDiv.classList.remove('hidden');
        } else {
            errorDiv.classList.add('hidden');
        }
    }
    
    // --- TAX CALCULATION LOGIC ---

    function getDepreciationRate(age) {
        if (age <= 1) return 0.0; if (age <= 2) return 0.20; if (age <= 3) return 0.30;
        if (age <= 4) return 0.40; if (age <= 5) return 0.50; if (age <= 6) return 0.55;
        if (age <= 7) return 0.60; if (age <= 8) return 0.65; if (age <= 9) return 0.70;
        if (age <= 10) return 0.75; return 0.80;
    }
    
    function getFuelExciseDutyRate(cc) {
        if (cc <= 1500) return 0.05; if (cc <= 2500) return 0.10; return 0.15;
    }

    function getHybridExciseDutyRate(age) {
        if (age <= 3) return 0.05; if (age <= 7) return 0.10; return 0.15;
    }
    
    function getRegistrationFee(cc, fuelType) {
        if (fuelType === 'Electric') return 285000;
        if (cc <= 1000) return 75000;
        if (cc <= 1500) return 285000;
        if (cc <= 3000) return 445000;
        if (cc <= 4500) return 748000;
        return 997000;
    }

    function calculateTaxes() {
        const errorMessage = validateInputs();
        if (errorMessage) {
            displayError(errorMessage);
            return;
        }
        displayError(null);
        
        formDiv.classList.add('hidden');
        loaderDiv.style.display = 'flex';

        setTimeout(() => {
            const year = parseInt(yearChoices.getValue(true));
            const engineCC = parseInt(engineInput.value);
            const freightCost = parseFloat(freightInput.value);
            const insuranceCost = parseFloat(insuranceInput.value);
            const fuelType = fuelTypeSelect.value;
            const utilityType = utilityTypeSelect.value;
            
            const carAge = new Date().getFullYear() - year;
            const depreciationRate = getDepreciationRate(carAge);
            const depreciatedValue = valueAsNew * (1 - depreciationRate);
            const cifValue = depreciatedValue + freightCost + insuranceCost;
            
            const infrastructureLevy = cifValue * 0.015;
            const registrationFeeRWF = getRegistrationFee(engineCC, fuelType);
            const registrationFeeUSD = registrationFeeRWF / USD_RWF_EXCHANGE_RATE;

            let customsDuty = 0, exciseDuty = 0, vat = 0, withholdingTax = 0;
            let customsRateText = "0% (Exempt)", exciseRateText = "0% (N/A)";

            if (fuelType === 'Fuel') {
                document.getElementById('withholding-tax-row').classList.add('hidden');
                customsDuty = cifValue * 0.25; customsRateText = `25%`;
                if (utilityType === 'Sedan' || utilityType === 'SUV') {
                    const exciseDutyRate = getFuelExciseDutyRate(engineCC);
                    exciseDuty = cifValue * exciseDutyRate;
                    exciseRateText = `${(exciseDutyRate * 100).toFixed(0)}% (by CC)`;
                }
                vat = (cifValue + customsDuty + exciseDuty + infrastructureLevy) * 0.18;
            } else if (fuelType === 'Hybrid') {
                document.getElementById('withholding-tax-row').classList.remove('hidden');
                customsDuty = 0;
                if (utilityType === 'Sedan' || utilityType === 'SUV') {
                    const exciseDutyRate = getHybridExciseDutyRate(carAge);
                    exciseDuty = cifValue * exciseDutyRate;
                    exciseRateText = `${(exciseDutyRate * 100).toFixed(0)}% (by Age)`;
                }
                withholdingTax = cifValue * 0.05;
                vat = (cifValue + customsDuty + exciseDuty + infrastructureLevy) * 0.18;
            } else if (fuelType === 'Electric') {
                 document.getElementById('withholding-tax-row').classList.add('hidden');
                 customsDuty = 0; exciseDuty = 0; vat = 0; withholdingTax = 0;
            }
            
            const totalTaxUSD = customsDuty + exciseDuty + vat + withholdingTax + infrastructureLevy + registrationFeeUSD;
            const totalTaxRWF = totalTaxUSD * USD_RWF_EXCHANGE_RATE;
            const totalLandedCostUSD = cifValue + totalTaxUSD;
            const totalLandedCostRWF = totalLandedCostUSD * USD_RWF_EXCHANGE_RATE;

            const brand = makerChoices.getValue(true);
            const model = modelChoices.getValue(true);
            const spec = specChoices.getValue(true);
            document.getElementById('report-car-details').textContent = `${brand} ${model} ${year} - ${spec}`;
            
            document.getElementById('total-tax-rwf').textContent = formatRWF(totalTaxRWF);
            document.getElementById('total-tax-usd').textContent = formatUSD(totalTaxUSD);
            document.getElementById('total-landed-cost-rwf').textContent = formatRWF(totalLandedCostRWF);
            document.getElementById('total-landed-cost-usd').textContent = formatUSD(totalLandedCostUSD);
            
            document.getElementById('car-value-new').textContent = formatUSD(valueAsNew);
            document.getElementById('car-age').textContent = `${carAge} years`;
            document.getElementById('depreciation-rate').textContent = `${(depreciationRate * 100).toFixed(0)}%`;
            document.getElementById('fob-value').textContent = formatUSD(depreciatedValue);
            const cifRWF = cifValue * USD_RWF_EXCHANGE_RATE;
            document.getElementById('cif-value').textContent = `${formatUSD(cifValue)} (${formatRWF(cifRWF)})`;
            
            document.getElementById('infra-levy').textContent = formatUSD(infrastructureLevy);
            document.getElementById('customs-duty').parentElement.querySelector('span:first-child').textContent = `Customs Duty (${customsRateText}):`;
            document.getElementById('customs-duty').textContent = formatUSD(customsDuty);
            document.getElementById('excise-duty').parentElement.querySelector('span:first-child').textContent = `Excise Duty (${exciseRateText}):`;
            document.getElementById('excise-duty').textContent = formatUSD(exciseDuty);
            document.getElementById('withholding-tax').textContent = formatUSD(withholdingTax);
            document.getElementById('vat').textContent = formatUSD(vat);
            document.getElementById('registration-fee').textContent = `${formatRWF(registrationFeeRWF)} (${formatUSD(registrationFeeUSD)})`;
            
            loaderDiv.style.display = 'none';
            resultsDiv.classList.remove('hidden');

        }, 1000);
    }
    
    // --- EVENT LISTENERS ---
    makerSelectEl.addEventListener('change', (event) => {
        const brand = event.detail.value;
        yearChoices.clearStore(); yearChoices.disable(); modelChoices.clearStore(); modelChoices.disable(); specChoices.clearStore(); specChoices.disable();
        updatePriceDisplay(0);
        if (brand) fetchAndSetChoices(`${API_URL}/years?brand=${encodeURIComponent(brand)}`, yearChoices, 'Select Year');
    });

    yearSelectEl.addEventListener('change', (event) => {
        const brand = makerChoices.getValue(true);
        const year = event.detail.value;
        modelChoices.clearStore(); modelChoices.disable(); specChoices.clearStore(); specChoices.disable();
        updatePriceDisplay(0);
        if (brand && year) fetchAndSetChoices(`${API_URL}/models?brand=${encodeURIComponent(brand)}&year=${year}`, modelChoices, 'Select Model');
    });
    
    modelSelectEl.addEventListener('change', (event) => {
        const brand = makerChoices.getValue(true);
        const year = yearChoices.getValue(true);
        const model = event.detail.value;
        specChoices.clearStore(); specChoices.disable();
        updatePriceDisplay(0);
        if (brand && year && model) fetchAndSetChoices(`${API_URL}/specs?brand=${encodeURIComponent(brand)}&year=${year}&model=${encodeURIComponent(model)}`, specChoices, 'Select Specs');
    });

    specSelectEl.addEventListener('change', async (event) => {
        const brand = makerChoices.getValue(true);
        const year = yearChoices.getValue(true);
        const model = modelChoices.getValue(true);
        const spec = event.detail.value;
        updatePriceDisplay(0);
        if (brand && year && model && spec) {
            try {
                const res = await fetch(`${API_URL}/price?brand=${encodeURIComponent(brand)}&year=${year}&model=${encodeURIComponent(model)}&spec=${encodeURIComponent(spec)}`);
                if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
                const data = await res.json();
                updatePriceDisplay(data.price ?? 0);
            } catch (error) {
                displayError(`Could not fetch price. Error: ${error.message}`);
                updatePriceDisplay(0);
            }
        }
    });

    fuelTypeSelect.addEventListener('change', (event) => {
        const isElectric = event.target.value === 'Electric';
        engineInput.disabled = isElectric;
        utilityTypeSelect.disabled = isElectric;
        if (isElectric) { engineInput.value = ''; utilityTypeSelect.value = ''; }
    });

    calculateBtn.addEventListener('click', calculateTaxes);
    recalculateBtn.addEventListener('click', () => location.reload());
    
    // --- INITIALIZATION ---
    getExchangeRate();
    initializeBrands();
});
