/* ============================================
   THE GYM RATS — workouts.js
   Workout Tracker, PRs & Streaks
   ============================================ */

pageRenderers['workouts'] = renderWorkouts;

let exerciseCount = 0;

document.getElementById('btn-new-workout').addEventListener('click', () => {
  document.getElementById('workout-form-card').style.display = 'block';
  setTodayDate('wf-date');
  exerciseCount = 0;
  document.getElementById('exercises-list').innerHTML = '';
  addExerciseRow();
  document.getElementById('workout-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('btn-cancel-workout').addEventListener('click', () => {
  document.getElementById('workout-form-card').style.display = 'none';
  document.getElementById('workout-form').reset();
  document.getElementById('exercises-list').innerHTML = '';
  exerciseCount = 0;
});

document.getElementById('btn-add-exercise').addEventListener('click', addExerciseRow);

function addExerciseRow() {
  exerciseCount++;
  const id = exerciseCount;
  const div = document.createElement('div');
  div.className = 'exercise-row';
  div.id = `ex-row-${id}`;
  div.innerHTML = `
    <div class="exercise-row-header">
      <input type="text" placeholder="Exercise name (e.g. Bench Press)" id="ex-name-${id}" style="font-weight:700;max-width:280px" />
      <button type="button" class="btn-icon" onclick="removeExerciseRow(${id})">✕</button>
    </div>
    <div class="sets-grid-header">
      <span>SET</span><span>WEIGHT (kg)</span><span>REPS</span><span></span>
    </div>
    <div id="ex-sets-${id}"></div>
    <button type="button" class="btn-ghost" style="font-size:0.78rem;padding:0.4rem 0.75rem;margin-top:0.4rem"
      onclick="addSetRow(${id})">+ Add Set</button>`;
  document.getElementById('exercises-list').appendChild(div);
  addSetRow(id);
}

function addSetRow(exId) {
  const container = document.getElementById(`ex-sets-${exId}`);
  const setNum = container.children.length + 1;
  const row = document.createElement('div');
  row.className = 'sets-grid';
  row.innerHTML = `
    <input type="number" placeholder="${setNum}" value="${setNum}" min="1" style="text-align:center" readonly />
    <input type="number" placeholder="0" min="0" step="0.5" class="set-weight" />
    <input type="number" placeholder="0" min="0" class="set-reps" />
    <button type="button" class="btn-icon" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(row);
}

function removeExerciseRow(id) {
  const el = document.getElementById(`ex-row-${id}`);
  if (el) el.remove();
}

document.getElementById('workout-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const name     = document.getElementById('wf-name').value.trim();
  const muscle   = document.getElementById('wf-muscle').value;
  const date     = document.getElementById('wf-date').value;
  const duration = parseInt(document.getElementById('wf-duration').value) || 0;
  const notes    = document.getElementById('wf-notes').value.trim();

  const exercises = [];
  let totalVolume = 0;
  const newPRs = [];

  document.querySelectorAll('.exercise-row').forEach(row => {
    const exId   = row.id.replace('ex-row-', '');
    const exName = document.getElementById(`ex-name-${exId}`)?.value.trim();
    if (!exName) return;
    const sets = [];
    row.querySelectorAll('.sets-grid').forEach(setRow => {
      const weight = parseFloat(setRow.querySelector('.set-weight')?.value) || 0;
      const reps   = parseInt(setRow.querySelector('.set-reps')?.value) || 0;
      if (reps > 0) {
        sets.push({ weight, reps });
        totalVolume += weight * reps;
      }
    });
    if (sets.length) {
      exercises.push({ name: exName, sets });
      // PR detection
      const pr = checkAndUpdatePR(exName, sets);
      if (pr) newPRs.push({ exercise: exName, ...pr });
    }
  });

  if (!exercises.length) { showToast('Add at least one exercise with sets.', 'error'); return; }

  const workout = { name, muscle, date, duration, notes, exercises, totalVolume, prs: newPRs };
  addRecord('workouts', workout);

  this.reset();
  document.getElementById('workout-form-card').style.display = 'none';
  document.getElementById('exercises-list').innerHTML = '';
  exerciseCount = 0;

  if (newPRs.length) {
    showToast(`🏆 NEW PR! ${newPRs.map(p => p.exercise).join(', ')}`, 'success');
  } else {
    showToast('Workout saved!', 'success');
  }
  renderWorkouts();
  updateNotifBadge();
});

function checkAndUpdatePR(exerciseName, sets) {
  const data = loadData();
  const key  = exerciseName.toLowerCase().trim();
  const existing = data.exercises[key];
  const bestSet  = sets.reduce((best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) ? s : best, sets[0]);

  let isNewPR = false;
  if (!existing) {
    isNewPR = true;
  } else if (bestSet.weight > existing.bestWeight || (bestSet.weight === existing.bestWeight && bestSet.reps > existing.bestReps)) {
    isNewPR = true;
  }

  if (isNewPR) {
    const prev = existing ? { weight: existing.bestWeight, reps: existing.bestReps } : null;
    data.exercises[key] = {
      bestWeight: bestSet.weight,
      bestReps:   bestSet.reps,
      updatedAt:  new Date().toISOString()
    };
    saveData(data);
    return { weight: bestSet.weight, reps: bestSet.reps, prev };
  }
  return null;
}

function renderWorkouts() {
  const workouts = getData('workouts').sort((a, b) => new Date(b.date) - new Date(a.date));
  const streak   = calculateWorkoutStreak();
  const thisMonth = workouts.filter(w => w.date.startsWith(new Date().toISOString().slice(0, 7))).length;
  const thisYear  = workouts.filter(w => w.date.startsWith(new Date().getFullYear().toString())).length;
  const totalVol  = workouts.reduce((s, w) => s + (w.totalVolume || 0), 0);

  document.getElementById('workout-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${streak.current}🔥</div><div class="stat-label">Current Streak</div></div>
    <div class="stat-card"><div class="stat-value">${streak.longest}</div><div class="stat-label">Longest Streak</div></div>
    <div class="stat-card"><div class="stat-value">${thisMonth}</div><div class="stat-label">This Month</div></div>
    <div class="stat-card"><div class="stat-value">${thisYear}</div><div class="stat-label">This Year</div></div>`;

  const histEl = document.getElementById('workout-history-list');
  if (!workouts.length) {
    histEl.innerHTML = emptyState('🏋️', 'No workouts logged yet.');
  } else {
    histEl.innerHTML = workouts.map(w => `
      <div class="workout-item">
        <div class="workout-item-header">
          <div>
            <div class="workout-item-name">${w.name}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${w.muscle}</div>
          </div>
          <div style="text-align:right">
            <div class="workout-item-date">${formatDateDisplay(w.date)}</div>
            <button class="btn-icon" style="margin-top:4px" onclick="deleteWorkout('${w.id}')">🗑</button>
          </div>
        </div>
        <div class="workout-item-meta">
          ${w.duration ? `<span>⏱ ${w.duration} min</span>` : ''}
          <span>📦 ${w.exercises.length} exercises</span>
          ${w.totalVolume ? `<span>⚡ ${w.totalVolume.toLocaleString()} kg vol</span>` : ''}
          ${w.prs && w.prs.length ? `<span class="pr-badge">🏆 ${w.prs.length} PR${w.prs.length > 1 ? 's' : ''}</span>` : ''}
        </div>
        <div style="margin-top:0.65rem">
          ${w.exercises.map(ex => `
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem">
              <strong style="color:var(--text-primary)">${ex.name}</strong>
              ${ex.sets.map(s => `<span style="margin-left:0.5rem;color:var(--text-muted)">${s.weight}kg×${s.reps}</span>`).join('')}
            </div>`).join('')}
        </div>
      </div>`).join('');
  }

  // PRs
  const exercises = getData('exercises');
  const prEl = document.getElementById('pr-list');
  const prKeys = Object.keys(exercises);
  if (!prKeys.length) {
    prEl.innerHTML = emptyState('🏆', 'No personal records yet. Start logging workouts!');
  } else {
    prEl.innerHTML = prKeys.map(k => {
      const pr = exercises[k];
      return `
        <div class="expense-item">
          <div class="expense-item-left">
            <div class="expense-item-desc" style="text-transform:capitalize">${k}</div>
            <div class="expense-item-meta">Updated ${formatDateTime(pr.updatedAt)}</div>
          </div>
          <div class="pr-badge">🏆 ${pr.bestWeight}kg × ${pr.bestReps}</div>
        </div>`;
    }).join('');
  }
}

function deleteWorkout(id) {
  confirmDelete('Workout', () => {
    deleteRecord('workouts', id);
    showToast('Workout deleted.', 'success');
    renderWorkouts();
  });
}
