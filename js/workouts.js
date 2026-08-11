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

  const header = document.createElement('div');
  header.className = 'exercise-row-header';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Exercise name (e.g. Bench Press)';
  nameInput.id = `ex-name-${id}`;
  nameInput.style.cssText = 'font-weight:700;max-width:280px';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-icon';
  removeBtn.textContent = '✕';
  removeBtn.onclick = () => removeExerciseRow(id);

  header.appendChild(nameInput);
  header.appendChild(removeBtn);

  const setsHeader = document.createElement('div');
  setsHeader.className = 'sets-grid-header';
  setsHeader.innerHTML = '<span>SET</span><span>WEIGHT (kg)</span><span>REPS</span><span></span>';

  const setsContainer = document.createElement('div');
  setsContainer.id = `ex-sets-${id}`;

  const addSetBtn = document.createElement('button');
  addSetBtn.type = 'button';
  addSetBtn.className = 'btn-ghost';
  addSetBtn.style.cssText = 'font-size:0.78rem;padding:0.4rem 0.75rem;margin-top:0.4rem';
  addSetBtn.textContent = '+ Add Set';
  addSetBtn.onclick = () => addSetRow(id);

  div.appendChild(header);
  div.appendChild(setsHeader);
  div.appendChild(setsContainer);
  div.appendChild(addSetBtn);
  document.getElementById('exercises-list').appendChild(div);
  addSetRow(id);
}

function addSetRow(exId) {
  const container = document.getElementById(`ex-sets-${exId}`);
  const setNum    = container.children.length + 1;
  const row       = document.createElement('div');
  row.className   = 'sets-grid';

  const numInput = document.createElement('input');
  numInput.type  = 'number';
  numInput.placeholder = String(setNum);
  numInput.value = String(setNum);
  numInput.min   = '1';
  numInput.style.textAlign = 'center';
  numInput.readOnly = true;

  const weightInput = document.createElement('input');
  weightInput.type  = 'number';
  weightInput.placeholder = '0';
  weightInput.min   = '0';
  weightInput.step  = '0.5';
  weightInput.className = 'set-weight';

  const repsInput = document.createElement('input');
  repsInput.type  = 'number';
  repsInput.placeholder = '0';
  repsInput.min   = '0';
  repsInput.className = 'set-reps';

  const removeBtn = document.createElement('button');
  removeBtn.type  = 'button';
  removeBtn.className = 'btn-icon';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => row.remove());

  row.appendChild(numInput);
  row.appendChild(weightInput);
  row.appendChild(repsInput);
  row.appendChild(removeBtn);
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
    showToast(`NEW PR! ${newPRs.map(p => p.exercise).join(', ')}`, 'success');
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
    <div class="stat-card"><div class="stat-value">${streak.current}</div><div class="stat-label">Current Streak</div></div>
    <div class="stat-card"><div class="stat-value">${streak.longest}</div><div class="stat-label">Longest Streak</div></div>
    <div class="stat-card"><div class="stat-value">${thisMonth}</div><div class="stat-label">This Month</div></div>
    <div class="stat-card"><div class="stat-value">${thisYear}</div><div class="stat-label">This Year</div></div>`;

  const histEl = document.getElementById('workout-history-list');
  histEl.innerHTML = '';
  if (!workouts.length) {
    histEl.innerHTML = emptyState('', 'No workouts logged yet.');
  } else {
    workouts.forEach(w => {
      const item = document.createElement('div');
      item.className = 'workout-item';

      /* Header */
      const hdr = document.createElement('div');
      hdr.className = 'workout-item-header';

      const hdrLeft = document.createElement('div');
      const nameEl  = document.createElement('div');
      nameEl.className = 'workout-item-name';
      nameEl.textContent = w.name;
      const muscleEl = document.createElement('div');
      muscleEl.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:2px';
      muscleEl.textContent = w.muscle;
      hdrLeft.appendChild(nameEl);
      hdrLeft.appendChild(muscleEl);

      const hdrRight = document.createElement('div');
      hdrRight.style.textAlign = 'right';
      const dateEl = document.createElement('div');
      dateEl.className = 'workout-item-date';
      dateEl.textContent = formatDateDisplay(w.date);
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon';
      delBtn.style.marginTop = '4px';
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', () => deleteWorkout(w.id));
      hdrRight.appendChild(dateEl);
      hdrRight.appendChild(delBtn);

      hdr.appendChild(hdrLeft);
      hdr.appendChild(hdrRight);

      /* Meta */
      const meta = document.createElement('div');
      meta.className = 'workout-item-meta';
      if (w.duration) { const s = document.createElement('span'); s.textContent = `${w.duration} min`; meta.appendChild(s); }
      const exSpan = document.createElement('span'); exSpan.textContent = `${w.exercises.length} exercises`; meta.appendChild(exSpan);
      if (w.totalVolume) { const s = document.createElement('span'); s.textContent = `${w.totalVolume.toLocaleString()} kg vol`; meta.appendChild(s); }
      if (w.prs && w.prs.length) { const s = document.createElement('span'); s.className = 'pr-badge'; s.textContent = `PR ×${w.prs.length}`; meta.appendChild(s); }

      /* Exercises */
      const exList = document.createElement('div');
      exList.style.marginTop = '0.65rem';
      w.exercises.forEach(ex => {
        const exRow = document.createElement('div');
        exRow.style.cssText = 'font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.3rem';
        const exName = document.createElement('strong');
        exName.style.color = 'var(--text-primary)';
        exName.textContent = ex.name;
        exRow.appendChild(exName);
        ex.sets.forEach(s => {
          const setSpan = document.createElement('span');
          setSpan.style.cssText = 'margin-left:0.5rem;color:var(--text-muted)';
          setSpan.textContent = `${s.weight}kg×${s.reps}`;
          exRow.appendChild(setSpan);
        });
        exList.appendChild(exRow);
      });

      item.appendChild(hdr);
      item.appendChild(meta);
      item.appendChild(exList);
      histEl.appendChild(item);
    });
  }

  /* PRs */
  const exercises = getData('exercises');
  const prEl  = document.getElementById('pr-list');
  prEl.innerHTML = '';
  const prKeys = Object.keys(exercises);
  if (!prKeys.length) {
    prEl.innerHTML = emptyState('', 'No personal records yet. Start logging workouts!');
  } else {
    prKeys.forEach(k => {
      const pr   = exercises[k];
      const item = document.createElement('div');
      item.className = 'expense-item';

      const left = document.createElement('div');
      left.className = 'expense-item-left';

      const descEl = document.createElement('div');
      descEl.className = 'expense-item-desc';
      descEl.style.textTransform = 'capitalize';
      descEl.textContent = k;

      const metaEl = document.createElement('div');
      metaEl.className = 'expense-item-meta';
      metaEl.textContent = `Updated ${formatDateTime(pr.updatedAt)}`;

      left.appendChild(descEl);
      left.appendChild(metaEl);

      const badge = document.createElement('div');
      badge.className = 'pr-badge';
      badge.textContent = `PR — ${pr.bestWeight}kg × ${pr.bestReps}`;

      item.appendChild(left);
      item.appendChild(badge);
      prEl.appendChild(item);
    });
  }
}

function deleteWorkout(id) {
  confirmDelete('Workout', () => {
    deleteRecord('workouts', id);
    showToast('Workout deleted.', 'success');
    renderWorkouts();
  });
}
