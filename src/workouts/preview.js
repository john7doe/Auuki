//
// Workout target preview helpers.
//
// findNextChange walks forward over the current/upcoming workout steps to
// find the next step whose `field` (power / cadence / slope) differs from
// the current value. Used by watch.js to drive the "→ next target" preview
// shown ~15s before each transition.
//
// The function is pure (no DOM, no db, no FTP awareness): callers convert
// fractional power to absolute watts after a match is returned.
//

function normalize(value) {
    if(value === undefined || value === null) return 0;
    return value;
}

function fieldEquals(field, a, b) {
    const A = normalize(a);
    const B = normalize(b);
    if(field === 'power') return Math.abs(A - B) < 1e-6;
    if(field === 'slope') return Math.abs(A - B) < 1e-3;
    // cadence (integer)
    return A === B;
}

//
// findNextChange({ intervals, intervalIndex, stepIndex, stepTime, field, horizonSec })
//
// - intervals:     db.workout.intervals
// - intervalIndex: current interval index (i)
// - stepIndex:     current step index within interval i (s)
// - stepTime:      seconds remaining in the current step
// - field:         'power' | 'cadence' | 'slope'
// - horizonSec:    look-ahead window in seconds (default 15)
//
// Returns { value, secondsUntil } when a different value is found within
// the horizon; otherwise null. `value` is normalised (undefined → 0).
// For 'power' the returned value is still the workout-fractional value;
// the caller is responsible for converting to absolute watts.
//
function findNextChange({
    intervals,
    intervalIndex,
    stepIndex,
    stepTime,
    field,
    horizonSec = 15,
}) {
    if(!Array.isArray(intervals) || intervals.length === 0) return null;
    const curInterval = intervals[intervalIndex];
    if(!curInterval || !Array.isArray(curInterval.steps)) return null;
    const curStep = curInterval.steps[stepIndex];
    if(!curStep) return null;

    const current = curStep[field];
    const remaining = Math.max(0, stepTime ?? 0);

    let cumulative = remaining;
    let i = intervalIndex;
    let s = stepIndex;

    while(true) {
        const steps = intervals[i].steps;
        if(steps && s + 1 < steps.length) {
            s += 1;
        } else if(i + 1 < intervals.length) {
            i += 1;
            s = 0;
        } else {
            return null;
        }

        if(cumulative > horizonSec) return null;

        const nextStep = intervals[i].steps?.[s];
        if(!nextStep) return null;
        const nextValue = nextStep[field];

        if(!fieldEquals(field, nextValue, current)) {
            return {
                value: normalize(nextValue),
                secondsUntil: cumulative,
            };
        }

        cumulative += nextStep.duration ?? 0;
    }
}

export { findNextChange, fieldEquals };
