"""MODE — Protocol Mapper v2

Maps Agent 3 output into mobile-app-compatible goal records.
Handles the actual markdown format Agent 3 produces.
"""

import re
import uuid
from datetime import datetime, timedelta


def map_agent3_to_goals(playbook_id: str, biweekly: dict, phases: list,
                         member_id: str = None, start_date: str = None) -> dict:
    base = datetime.strptime(start_date, '%Y-%m-%d') if start_date else datetime.now()
    results = {'phases': [], 'guidelines': [], 'supplements': [], 'nutrition': [],
               'sleep': [], 'stress': [], 'activities': []}

    week_ranges = [(1,2),(3,4),(5,6),(7,8),(9,10),(11,12)]

    # ── Phases ──
    phase_meta = [('Groundwork','Months 1-4',1,16), ('Integration','Months 5-8',17,32), ('Transformation','Months 9-12',33,48)]
    for i, phase in enumerate(phases):
        _, _, ws, we = phase_meta[i] if i < 3 else ('',''+ 1, 48)
        results['phases'].append({
            'id': str(uuid.uuid4()), 'playbook_id': playbook_id, 'member_id': member_id,
            'title': phase.get('name', f'Phase {i+1}'),
            'description': phase.get('focus', ''),
            'start_date': (base + timedelta(weeks=ws-1)).isoformat(),
            'target_date': (base + timedelta(weeks=we)).isoformat(),
            'status': 'active' if i == 0 else 'draft',
            'nutrition': phase.get('nutrition', ''),
            'movement': phase.get('physical_activity', ''),
            'sleep': phase.get('sleep', ''),
            'stress': phase.get('stress', ''),
            'weeks': list(range(ws, we+1)),
            'generated_by': 'playbook_ai',
        })

    # ── Process each component ──
    for pi, (ws, we) in enumerate(week_ranges):
        weeks = list(range(ws, we+1))
        sd = (base + timedelta(weeks=ws-1)).strftime('%Y-%m-%d')
        ed = (base + timedelta(weeks=we)).strftime('%Y-%m-%d')

        # SUPPLEMENTS
        card = (biweekly.get('supplements') or [{}])[pi] if pi < len(biweekly.get('supplements', [])) else {}
        if card and card.get('how_to_practice'):
            for si, step in enumerate(card['how_to_practice']):
                supp = _parse_supplement(step)
                if supp:
                    results['supplements'].append({
                        'id': str(uuid.uuid4()), 'playbook_id': playbook_id, 'member_id': member_id,
                        'goal_id': str(uuid.uuid4()),
                        'title': supp['name'], 'category': f'supplements_{supp["form"]}',
                        'dosage': supp['dose'], 'dosage_unit': supp['unit'],
                        'time_of_day': supp['time'], 'frequency': supp['freq'],
                        'frequency_unit': supp['form'], 'intake_timing': supp['timing'],
                        'notes': supp['notes'], 'sequence': si+1,
                        'start_date': sd, 'end_date': ed, 'status': 'draft',
                        'generated_by': 'playbook_ai', 'weeks': weeks,
                    })

        # NUTRITION
        card = (biweekly.get('nutrition') or [{}])[pi] if pi < len(biweekly.get('nutrition', [])) else {}
        if card and card.get('how_to_practice'):
            for si, step in enumerate(card['how_to_practice']):
                group = _classify_nutrition(step)
                results['nutrition'].append({
                    'id': str(uuid.uuid4()), 'playbook_id': playbook_id, 'member_id': member_id,
                    'goal_id': str(uuid.uuid4()),
                    'title': _make_title(step), 'nutrition_group': group,
                    'category': f'nutrition_{group}',
                    'samples': _extract_nutrition_samples(step, group),
                    'notes': step, 'sequence': si+1,
                    'start_date': sd, 'end_date': ed, 'status': 'draft',
                    'generated_by': 'playbook_ai', 'weeks': weeks,
                })

        # SLEEP
        card = (biweekly.get('sleep') or [{}])[pi] if pi < len(biweekly.get('sleep', [])) else {}
        if card and card.get('how_to_practice'):
            for si, step in enumerate(card['how_to_practice']):
                cat = _classify_sleep(step)
                tod = _sleep_time_of_day(step)
                results['sleep'].append({
                    'id': str(uuid.uuid4()), 'playbook_id': playbook_id, 'member_id': member_id,
                    'goal_id': str(uuid.uuid4()),
                    'title': _make_title(step), 'category': cat,
                    'note': f'[{tod}] {step}', 'sequence': si+1,
                    'start_date': sd, 'end_date': ed, 'status': 'draft',
                    'generated_by': 'playbook_ai', 'weeks': weeks,
                })

        # STRESS
        card = (biweekly.get('stress') or [{}])[pi] if pi < len(biweekly.get('stress', [])) else {}
        if card:
            for si, step in enumerate(card.get('how_to_practice', [])):
                tod = 'morning' if any(k in step.lower() for k in ['morning','wake','am']) else 'evening' if any(k in step.lower() for k in ['evening','night','bed','pm']) else 'daytime'
                dur = _extract_mins(step)
                results['stress'].append({
                    'id': str(uuid.uuid4()), 'playbook_id': playbook_id, 'member_id': member_id,
                    'goal_id': str(uuid.uuid4()),
                    'title': _make_title(step),
                    'category': _classify_stress_step(step),
                    'time_of_day': tod, 'range_start': str(dur) if dur else None,
                    'range_unit': 'mins', 'frequency': 1, 'recurrence': 'daily',
                    'notes': step, 'sequence': si+1,
                    'start_date': sd, 'end_date': ed, 'status': 'draft',
                    'generated_by': 'playbook_ai', 'weeks': weeks,
                })

        # ACTIVITIES
        card = (biweekly.get('physical_activity') or [{}])[pi] if pi < len(biweekly.get('physical_activity', [])) else {}
        if card and card.get('how_to_practice'):
            for si, step in enumerate(card['how_to_practice']):
                group, cat = _classify_activity(step)
                results['activities'].append({
                    'id': str(uuid.uuid4()), 'playbook_id': playbook_id, 'member_id': member_id,
                    'goal_id': str(uuid.uuid4()),
                    'title': _make_title(step), 'category': cat, 'activity_group': group,
                    'range_start': _extract_number(step), 'range_unit': _activity_unit(step),
                    'frequency': 1, 'recurrence': 'daily',
                    'notes': step, 'sequence': si+1,
                    'start_date': sd, 'end_date': ed, 'status': 'draft',
                    'generated_by': 'playbook_ai', 'weeks': weeks,
                })

    # ── General guidelines ──
    all_text = ' '.join(str(v) for v in biweekly.values())
    gl = []
    if '12' in all_text and 'fast' in all_text.lower():
        gl.append(('Start 12-Hour Overnight Fast Daily', 'general_guides_12_hr_eating_window'))
    if 'screen' in all_text.lower() and ('10' in all_text or 'bed' in all_text.lower()):
        gl.append(('No Screens Post 10 PM', 'general_guides_screen_curfew'))
    if 'gluten' in all_text.lower():
        gl.append(('Avoid Gluten', 'general_guides_avoid_gluten'))
    if 'caffeine' in all_text.lower():
        gl.append(('Limit Caffeine After 2 PM', 'general_guides_caffeine_cutoff'))
    for gi, (t, c) in enumerate(gl):
        results['guidelines'].append({
            'id': str(uuid.uuid4()), 'playbook_id': playbook_id, 'member_id': member_id,
            'title': t, 'category': c, 'sequence': gi+1, 'status': 'draft',
            'generated_by': 'playbook_ai', 'weeks': list(range(1, 49)),
        })

    return results


# ══ Supplement parsing ══

def _parse_supplement(step: str) -> dict:
    s = step.strip()
    # Skip non-supplement lines
    skip = ['all previous', 'safety', 'discontinue', 'total supplement', 'continue', 'no interaction']
    if any(k in s.lower() for k in skip):
        return None
    if len(s) < 10:
        return None

    # Remove leading ** and numbers
    s = re.sub(r'^\*{0,2}\s*\d*\.?\s*', '', s).strip()
    s = re.sub(r'\*{2}', '', s)

    # Extract name: text before first colon or dose
    name_m = re.match(r'^([A-Za-z0-9\s\-/()]+?)(?:\s*:|\s+\d)', s)
    name = name_m.group(1).strip() if name_m else s.split(':')[0].split(' - ')[0].strip()
    name = name[:60]

    # Extract dose
    dose_m = re.search(r'(\d+[\.,]?\d*)\s*(mg|mcg|µg|IU|g|ml|unit)', s, re.IGNORECASE)
    dose = dose_m.group(0).strip() if dose_m else ''
    unit = dose_m.group(2).strip() if dose_m else ''

    # Time of day
    sl = s.lower()
    if 'morning' in sl or 'breakfast' in sl or 'am' in sl:
        time = 'morning'
    elif 'evening' in sl or 'dinner' in sl or 'bed' in sl or 'pm' in sl or 'night' in sl:
        time = 'evening'
    elif 'afternoon' in sl or 'lunch' in sl:
        time = 'afternoon'
    else:
        time = 'morning'

    # Intake timing
    if 'empty' in sl or 'before' in sl:
        timing = 'pre_meal'
    elif 'with food' in sl or 'with breakfast' in sl or 'with meal' in sl or 'with fat' in sl:
        timing = 'with_meal'
    elif 'after' in sl or 'post' in sl:
        timing = 'post_meal'
    else:
        timing = 'with_meal'

    # Form
    form = 'capsule'
    if 'sublingual' in sl: form = 'sublingual'
    elif 'powder' in sl or 'scoop' in sl: form = 'powder'
    elif 'tablet' in sl: form = 'tablet'
    elif 'liquid' in sl or 'oil' in sl or 'drop' in sl: form = 'liquid'

    # Frequency
    freq_m = re.search(r'(\d+)\s*(?:x|times)\s*(?:daily|per day)', sl)
    freq = int(freq_m.group(1)) if freq_m else 1

    return {'name': name, 'dose': dose, 'unit': unit, 'time': time,
            'timing': timing, 'form': form, 'freq': freq, 'notes': s}


# ══ Nutrition ══

def _classify_nutrition(step: str) -> str:
    s = step.lower()
    if any(k in s for k in ['eliminate', 'remove', 'avoid', 'stop', 'cut out', 'no more']): return 'elimination'
    if any(k in s for k in ['water', 'hydrat', 'drink', 'liquid', 'litre', 'liter']): return 'hydration'
    if any(k in s for k in ['meal', 'breakfast', 'lunch', 'dinner', 'timing', 'eating window', 'structured']): return 'meal_framework'
    if any(k in s for k in ['fiber', 'fibre', 'prebiotic', 'ferment', 'probiotic', 'gut', 'bone broth']): return 'digestive_support'
    if any(k in s for k in ['rice', 'roti', 'dal', 'grain', 'millet', 'wheat', 'oat', 'quinoa']): return 'food_base'
    if any(k in s for k in ['protein', 'egg', 'chicken', 'fish', 'paneer', 'whey']): return 'food_base'
    return 'addition'

def _extract_nutrition_samples(step: str, group: str) -> list:
    """Extract food items as structured samples."""
    foods = re.findall(r'(?:palak|methi|ragi|jowar|bajra|dal|paneer|curd|ghee|amla|turmeric|moringa|flaxseed|chia|walnut|almond|broccoli|spinach|cabbage|beetroot|carrot|pumpkin|oats|quinoa|brown rice|millet|fish|chicken|egg|whey|bone broth|curd|buttermilk|sabji|roti|idli|dosa|upma)', step.lower())
    if foods:
        return [{'title': f.capitalize()} for f in sorted(set(foods))]

    # If no specific foods, create a single sample from the step
    title = _make_title(step)
    return [{'title': title}]


# ══ Sleep ══

def _classify_sleep(step: str) -> str:
    s = step.lower()
    if any(k in s for k in ['screen', 'phone', 'device', 'blue light']): return 'screen_curfew'
    if any(k in s for k in ['temperature', 'cool', 'dark', 'curtain', 'mask']): return 'environment'
    if any(k in s for k in ['caffeine', 'coffee', 'tea']): return 'caffeine'
    if any(k in s for k in ['bed', 'routine', 'wind', 'ritual']): return 'bedtime_routine'
    if any(k in s for k in ['sunlight', 'morning light', 'circadian']): return 'circadian'
    if any(k in s for k in ['herbal', 'chamomile', 'valerian']): return 'herbal'
    return 'other'

def _sleep_time_of_day(step: str) -> str:
    s = step.lower()
    if any(k in s for k in ['morning', 'sunlight', 'wake']): return 'morning'
    if any(k in s for k in ['evening', 'night', 'bed', 'dim', 'screen']): return 'evening'
    return 'evening'


# ══ Stress ══

def _classify_stress_step(step: str) -> str:
    s = step.lower()
    if 'box breath' in s or '4-4-4' in s or '4-7-8' in s: return 'stress_box_breathing'
    if 'nadi' in s: return 'stress_nadi_shodhana'
    if 'yoga nidra' in s: return 'stress_yoga_nidra'
    if 'meditat' in s or 'mindful' in s: return 'stress_meditation'
    if 'journal' in s or 'writing' in s: return 'stress_journaling'
    if 'body scan' in s: return 'stress_body_scan'
    if 'grounding' in s or 'sunlight' in s: return 'stress_grounding'
    return 'stress_breathwork'


# ══ Activities ══

def _classify_activity(step: str) -> tuple:
    s = step.lower()
    if any(k in s for k in ['walk', 'step', 'post-meal', 'post meal']): return ('neat', 'activities_walking')
    if any(k in s for k in ['yoga', 'stretch', 'flexibility', 'mobility']): return ('mobility', 'activities_yoga')
    if any(k in s for k in ['push', 'squat', 'plank', 'deadlift', 'dumbbell', 'resistance', 'weight', 'band']): return ('strength', 'activities_strength')
    if any(k in s for k in ['zone 2', 'cardio', 'run', 'swim', 'cycle', 'interval', 'hiit']): return ('cardio', 'activities_cardio')
    if any(k in s for k in ['standing', 'posture']): return ('mobility', 'activities_posture')
    return ('neat', 'activities_general')

def _activity_unit(step: str) -> str:
    s = step.lower()
    if 'step' in s: return 'steps'
    if 'min' in s: return 'mins'
    if 'rep' in s: return 'reps'
    if 'set' in s: return 'sets'
    return 'mins'


# ══ Common helpers ══

def _make_title(step: str) -> str:
    t = re.sub(r'^\*{0,2}\s*\d*\.?\s*', '', step).strip()
    t = re.sub(r'\*{2}', '', t)
    # Take first sentence or clause
    for sep in [':', ' - ', '. ', ',']:
        if sep in t and t.index(sep) > 5:
            t = t[:t.index(sep)]
            break
    return t.strip()[:80]

def _extract_mins(step: str) -> int:
    m = re.search(r'(\d+)\s*min', step, re.IGNORECASE)
    return int(m.group(1)) if m else None

def _extract_number(step: str) -> str:
    m = re.search(r'(\d+)', step)
    return m.group(1) if m else None
