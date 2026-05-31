import { useState, useEffect } from 'react';

const CURRENCY  = '₹';

export default function Popup() {
    const [budget, setBudget] = useState('');
    const [spent, setSpent] = useState(0);
    const [saved, setSaved] = useState(false);
    const [connected, setConnected] = useState(false);

    //Loading saved settings on mount
    useEffect(() => {
        chrome.storage.sync.get(['monthlyBudget', 'swiggyConnected'], (result) => {
            if(result.monthlyBudget) setBudget(String(result.monthlyBudget));
            if(result.swiggyConnected) setConnected(result.swiggyConnected);
        });

        chrome.storage.local.get(['monthlySpent'], (result) => {
            if(result.monthlySpent !== undefined) setSpent(result.monthlySpent);
        })
    }, []);

    const handleBudgetChange = (e) => {
        const val = e.target.value.replace(/\D/g, '');
        setBudget(val);

        const onSaved = () => {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        }

        if(val === '') {
            chrome.storage.sync.remove(['monthlyBudget'], onSaved);
            return;
        }

        chrome.storage.sync.set(
            { monthlyBudget: Number(val), budgetCurrency: 'INR'},
            onSaved
        )
    }

    const handleConnectSwiggy = () => {
        chrome.runtime.sendMessage( { type: 'TRIGGER_AUTH' }, (response) => {
            if(chrome.runtime.lastError) {
                console.warn('[BudgetBite]', chrome.runtime.lastError.message);
                return;
            }

            if(response?.success) setConnected(true);
        })
    }

    const handleReset = () => {
        chrome.storage.sync.remove(['monthlyBudget', 'budgetCurrency', 'swiggyConnected']);

        chrome.storage.local.remove(['monthlySpent']);

        if(chrome.storage.session) chrome.storage.session.clear();

        setBudget('');
        setSpent(0);
        setConnected(false);
    }

    const budgetNum = Number(budget) || 0;
    const remaining = Math.max(budgetNum - spent, 0);
    const percentUsed = (budgetNum > 0) ? Math.min((spent / budgetNum) * 100, 100) : 0;

    const barColor = percentUsed < 60 ? '#22c55e'
                 : percentUsed < 90 ? '#f59e0b'
                 : '#ef4444';

    return (
    <div className="popup">
        <header className="popup-header">
        <div className="popup-logo">🍽️</div>
        <div>
            <h1 className="popup-title">BudgetBite</h1>
            <p className="popup-subtitle">Expense-aware food ordering</p>
        </div>
        <div className={`popup-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● Connected' : '○ Not connected'}
        </div>
        </header>

        <section className="popup-section">
        <div className="popup-label-row">
            <label className="popup-label">Monthly Food Budget</label>
            {saved && <span className="popup-saved" aria-live="polite">✓ Saved</span>}
        </div>
        <div className="popup-input-wrap">
            <span className="popup-currency">{CURRENCY}</span>
            <input
            type="text"
            className="popup-input"
            value={budget}
            onChange={handleBudgetChange}
            placeholder="2000"
            maxLength={6}
            />
        </div>
        </section>

        {budgetNum > 0 && (
        <section className="popup-section">
            <label className="popup-label">This Month</label>
            <div className="popup-stats">
            <div className="popup-stat">
                <span className="popup-stat-value">{CURRENCY}{spent}</span>
                <span className="popup-stat-label">Spent</span>
            </div>
            <div className="popup-stat">
                <span className="popup-stat-value" style={{ color: barColor }}>
                {CURRENCY}{remaining}
                </span>
                <span className="popup-stat-label">Remaining</span>
            </div>
            <div className="popup-stat">
                <span className="popup-stat-value">{CURRENCY}{budgetNum}</span>
                <span className="popup-stat-label">Budget</span>
            </div>
            </div>

            <div className="popup-progress-track">
            <div
                className="popup-progress-fill"
                style={{ width: `${percentUsed}%`, background: barColor }}
            />
            </div>
            <p className="popup-progress-label">
            {Math.round(percentUsed)}% of monthly budget used
            </p>
        </section>
        )}

        <section className="popup-section">
        {!connected ? (
            <button className="popup-btn popup-btn--primary" onClick={handleConnectSwiggy}>
            🔗 Connect Swiggy Account
            </button>
        ) : (
            <p className="popup-hint">
            ✅ Swiggy connected — monthly spend syncs from your account (Phase 5)
            </p>
        )}
        <p className="popup-hint-muted">
            Budget banner on checkout works with your saved budget; connect for live spend data.
        </p>
        </section>

        <section className="popup-section">
        <button className="popup-btn popup-btn--secondary" disabled>
            📊 Connect Google Sheets <span className="popup-badge">Phase 6</span>
        </button>
        </section>

        <footer className="popup-footer">
        <button className="popup-reset" onClick={handleReset}>Reset all data</button>
        </footer>
    </div>
    );
}