document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('state-grid');
    if (!grid || !window.STATE_LIST) return;

    grid.innerHTML = '';

    window.STATE_LIST.forEach((state, index) => {
        const card = document.createElement(state.available ? 'a' : 'div');
        card.className = `state-card animate-in${state.available ? '' : ' state-card-disabled'}`;
        card.style.animationDelay = `${index * 0.08}s`;

        if (state.available) {
            card.href = `/state/${state.slug}`;
        }

        card.innerHTML = `
            <div class="state-card-top">
                <span class="state-card-code">${state.stateCode}</span>
                <span class="state-card-status">${state.available ? 'Ready' : 'Coming Soon'}</span>
            </div>
            <div class="state-card-title">${state.stateName}</div>
            <div class="state-card-subtitle">Constituency-wise dashboard</div>
        `;

        grid.appendChild(card);
    });
});
