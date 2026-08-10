/* ============================================
   THE GYM RATS — progress.js
   Body Progress Tracker & Charts
   ============================================ */

pageRenderers['progress'] = renderProgress;

let chartWeight = null;
let chartMeasurements = null;

document.getElementById('btn-new-progress').addEventListener('click', () => {
  document.getElementById('progress-form-card').style.display = 'block';
  setTodayDate('pf-date');
  document.getElementById('progress-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('btn-cancel-progress').addEventListener('click', () => {
  document.getElementById('progress-form-card').style.display = 'none';
  document.getElementById('progress-form').reset();
});

document.getElementById('progress-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const record = {
    date:   document.getElementById('pf-date').value,
    weight: parseFloat(document.getElementById('pf-weight').value) || null,
    fat:    parseFloat(document.getElementById('pf-fat').value)    || null,
    chest:  parseFloat(document.getElementById('pf-chest').value)  || null,
    waist:  parseFloat(document.getElementById('pf-waist').value)  || null,
    arms:   parseFloat(document.getElementById('pf-arms').value)   || null,
    legs:   parseFloat(document.getElementById('pf-legs').value)   || null,
    notes:  document.getElementById('pf-notes').value.trim()
  };
  if (!record.weight && !record.chest && !record.waist && !record.arms && !record.legs) {
    showToast('Enter at least one measurement.', 'error');
    return;
  }
  addRecord('progress', record);
  this.reset();
  document.getElementById('progress-form-card').style.display = 'none';
  showToast('Progress logged!', 'success');
  renderProgress();
});

function renderProgress() {
  const logs = getData('progress').sort((a, b) => new Date(a.date) - new Date(b.date));

  renderWeightChart(logs);
  renderMeasurementsChart(logs);
  renderProgressLog(logs);
}

function renderWeightChart(logs) {
  const withWeight = logs.filter(l => l.weight);
  const ctx = document.getElementById('chart-weight').getContext('2d');
  if (chartWeight) chartWeight.destroy();
  if (!withWeight.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }
  chartWeight = new Chart(ctx, {
    type: 'line',
    data: {
      labels: withWeight.map(l => formatDateDisplay(l.date)),
      datasets: [{
        label: 'Weight (kg)',
        data: withWeight.map(l => l.weight),
        borderColor: '#e01c1c',
        backgroundColor: 'rgba(224,28,28,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#e01c1c',
        pointRadius: 4,
        tension: 0.3,
        fill: true
      }]
    },
    options: chartOptions('kg')
  });
}

function renderMeasurementsChart(logs) {
  const ctx = document.getElementById('chart-measurements').getContext('2d');
  if (chartMeasurements) chartMeasurements.destroy();
  const labels = logs.map(l => formatDateDisplay(l.date));
  const datasets = [
    { key: 'chest', label: 'Chest',  color: '#e01c1c' },
    { key: 'waist', label: 'Waist',  color: '#f97316' },
    { key: 'arms',  label: 'Arms',   color: '#22c55e' },
    { key: 'legs',  label: 'Legs',   color: '#3b82f6' }
  ].filter(d => logs.some(l => l[d.key]))
   .map(d => ({
    label: d.label,
    data: logs.map(l => l[d.key] || null),
    borderColor: d.color,
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointBackgroundColor: d.color,
    pointRadius: 3,
    tension: 0.3,
    spanGaps: true
  }));

  if (!datasets.length) return;
  chartMeasurements = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions('cm')
  });
}

function chartOptions(unit) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: '#a0a0a0', font: { size: 11 }, boxWidth: 12 }
      },
      tooltip: {
        backgroundColor: '#141414',
        borderColor: '#222',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#a0a0a0',
        callbacks: { label: ctx => ` ${ctx.parsed.y} ${unit}` }
      }
    },
    scales: {
      x: {
        ticks: { color: '#555', font: { size: 10 }, maxRotation: 45 },
        grid:  { color: '#1a1a1a' }
      },
      y: {
        ticks: { color: '#555', font: { size: 10 }, callback: v => v + unit },
        grid:  { color: '#1a1a1a' }
      }
    }
  };
}

function renderProgressLog(logs) {
  const el = document.getElementById('progress-log-list');
  if (!logs.length) {
    el.innerHTML = emptyState('📈', 'No progress logged yet.');
    return;
  }
  el.innerHTML = [...logs].reverse().map(l => `
    <div class="expense-item">
      <div class="expense-item-left">
        <div class="expense-item-desc">${formatDateDisplay(l.date)}</div>
        <div class="expense-item-meta" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:4px">
          ${l.weight ? `<span class="tag">⚖️ ${l.weight} kg</span>` : ''}
          ${l.fat    ? `<span class="tag">🔥 ${l.fat}% fat</span>` : ''}
          ${l.chest  ? `<span class="tag">Chest ${l.chest}cm</span>` : ''}
          ${l.waist  ? `<span class="tag">Waist ${l.waist}cm</span>` : ''}
          ${l.arms   ? `<span class="tag">Arms ${l.arms}cm</span>` : ''}
          ${l.legs   ? `<span class="tag">Legs ${l.legs}cm</span>` : ''}
        </div>
        ${l.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">${l.notes}</div>` : ''}
      </div>
      <button class="btn-icon" onclick="deleteProgress('${l.id}')">🗑</button>
    </div>`).join('');
}

function deleteProgress(id) {
  confirmDelete('Progress entry', () => {
    deleteRecord('progress', id);
    showToast('Entry deleted.', 'success');
    renderProgress();
  });
}
