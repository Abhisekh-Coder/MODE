"""MODE — Protocol Mapper

Maps Agent 3 structured output (30 biweekly cards) into the mobile app's
goal tables: supplement_goals, nutrition_goals, sleep_goals, stress_goals,
activity_goals, protocol_guidelines, protocol_phases.

Each card is decomposed into individual actionable goals with:
- title, category, time_of_day, dosage, frequency, weeks, sequence
- Matching the Supabase schema exactly
"""

import re
import uuid
from datetime import datetime, timedelta


def map_agent3_to_goals(playbook_id: str, biweekly: dict, phases: list,
                         member_id: str = None, start_date: str = None) -> dict:
    """Convert parsed Agent 3 output into structured goal records.

    Returns dict with keys: phases, guidelines, supplements, nutrition, sleep, stress, activities
    """
    base_date = datetime.strptime(start_date, '%Y-%m-%d') if start_date else datetime.now()
    results = {
        'phases': [],
        'guidelines': [],
        'supplements': [],
        'nutrition': [],
        'sleep': [],
        'stress': [],
        'activities': [],
    }

    # ── Map phases ──
    phase_weeks = [(1, 16), (17, 32), (33, 48)]
    for i, phase in enumerate(phases):
        wk_start, wk_end = phase_weeks[i] if i < 3 else (1, 48)
        p_start = base_date + timedelta(weeks=wk_start - 1)
        p_end = base_date + timedelta(weeks=wk_end)
        results['phases'].append({
            'id': str(uuid.uuid4()),
            'playbook_id': playbook_id,
            'member_id': member_id,
            'title': phase.get('name', f'Phase {i+1}'),
            'description': phase.get('focus', ''),
            'start_date': p_start.isoformat(),
            'target_date': p_end.isoformat(),
            'status': 'active' if i == 0 else 'draft',
            'nutrition': phase.get('nutrition', ''),
            'movement': phase.get('physical_activity', ''),
            'sleep': phase.get('sleep', ''),
            'stress': phase.get('stress', ''),
            'weeks': list(range(wk_start, wk_end + 1)),
            'generated_by': 'playbook_ai',
        })

    # ── Map biweekly cards to goals ──
    week_ranges = [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10), (11, 12)]

    # Supplements
    supp_cards = biweekly.get('supplements', [])
    for pi, card in enumerate(supp_cards):
        if not card or not card.get('title'):
            continue
        wk_start, wk_end = week_ranges[pi] if pi < 6 else (1, 2)
        weeks = list(range(wk_start, wk_end + 1))
        s_start = base_date + timedelta(weeks=wk_start - 1)
        s_end = base_date + timedelta(weeks=wk_end)

        # Parse individual supplements from HOW TO PRACTICE
        for si, step in enumerate(card.get('how_to_practice', [])):
            supp = _parse_supplement_step(step)
            if supp:
                results['supplements'].append({
                    'id': str(uuid.uuid4()),
                    'playbook_id': playbook_id,
                    'member_id': member_id,
                    'goal_id': str(uuid.uuid4()),
                    'title': supp['name'],
                    'category': f'supplements_{supp.get("form", "capsules")}',
                    'dosage': supp.get('dose', ''),
                    'dosage_unit': supp.get('unit', ''),
                    'time_of_day': supp.get('time', 'morning'),
                    'frequency': 1,
                    'frequency_unit': supp.get('form', 'capsule'),
                    'intake_timing': supp.get('timing', 'with_meal'),
                    'notes': supp.get('notes', ''),
                    'sequence': si + 1,
                    'start_date': s_start.strftime('%Y-%m-%d'),
                    'end_date': s_end.strftime('%Y-%m-%d'),
                    'status': 'draft',
                    'generated_by': 'playbook_ai',
                    'weeks': weeks,
                })

    # Nutrition
    nutr_cards = biweekly.get('nutrition', [])
    for pi, card in enumerate(nutr_cards):
        if not card or not card.get('title'):
            continue
        wk_start, wk_end = week_ranges[pi] if pi < 6 else (1, 2)
        weeks = list(range(wk_start, wk_end + 1))
        s_start = base_date + timedelta(weeks=wk_start - 1)
        s_end = base_date + timedelta(weeks=wk_end)

        for si, step in enumerate(card.get('how_to_practice', [])):
            group = _classify_nutrition(step)
            samples = _extract_food_samples(step)
            results['nutrition'].append({
                'id': str(uuid.uuid4()),
                'playbook_id': playbook_id,
                'member_id': member_id,
                'goal_id': str(uuid.uuid4()),
                'title': _clean_title(step)[:80],
                'nutrition_group': group,
                'category': f'nutrition_{group}',
                'samples': samples,
                'notes': step,
                'sequence': si + 1,
                'start_date': s_start.strftime('%Y-%m-%d'),
                'end_date': s_end.strftime('%Y-%m-%d'),
                'status': 'draft',
                'generated_by': 'playbook_ai',
                'weeks': weeks,
            })

    # Sleep
    sleep_cards = biweekly.get('sleep', [])
    for pi, card in enumerate(sleep_cards):
        if not card or not card.get('title'):
            continue
        wk_start, wk_end = week_ranges[pi] if pi < 6 else (1, 2)
        weeks = list(range(wk_start, wk_end + 1))
        s_start = base_date + timedelta(weeks=wk_start - 1)
        s_end = base_date + timedelta(weeks=wk_end)

        for si, step in enumerate(card.get('how_to_practice', [])):
            results['sleep'].append({
                'id': str(uuid.uuid4()),
                'playbook_id': playbook_id,
                'member_id': member_id,
                'goal_id': str(uuid.uuid4()),
                'title': _clean_title(step)[:80],
                'category': _classify_sleep(step),
                'note': step,
                'sequence': si + 1,
                'start_date': s_start.strftime('%Y-%m-%d'),
                'end_date': s_end.strftime('%Y-%m-%d'),
                'status': 'draft',
                'generated_by': 'playbook_ai',
                'weeks': weeks,
            })

    # Stress
    stress_cards = biweekly.get('stress', [])
    for pi, card in enumerate(stress_cards):
        if not card or not card.get('title'):
            continue
        wk_start, wk_end = week_ranges[pi] if pi < 6 else (1, 2)
        weeks = list(range(wk_start, wk_end + 1))
        s_start = base_date + timedelta(weeks=wk_start - 1)
        s_end = base_date + timedelta(weeks=wk_end)

        duration = _extract_duration(card.get('how_to_practice', []))
        results['stress'].append({
            'id': str(uuid.uuid4()),
            'playbook_id': playbook_id,
            'member_id': member_id,
            'goal_id': str(uuid.uuid4()),
            'title': card.get('title', f'Stress Wk {wk_start}-{wk_end}'),
            'category': _classify_stress(card),
            'time_of_day': 'morning',
            'range_start': str(duration) if duration else None,
            'range_unit': 'mins',
            'frequency': 1,
            'recurrence': 'daily',
            'notes': '; '.join(card.get('how_to_practice', [])),
            'sequence': pi + 1,
            'start_date': s_start.strftime('%Y-%m-%d'),
            'end_date': s_end.strftime('%Y-%m-%d'),
            'status': 'draft',
            'generated_by': 'playbook_ai',
            'weeks': weeks,
        })

    # Activities
    activity_cards = biweekly.get('physical_activity', [])
    for pi, card in enumerate(activity_cards):
        if not card or not card.get('title'):
            continue
        wk_start, wk_end = week_ranges[pi] if pi < 6 else (1, 2)
        weeks = list(range(wk_start, wk_end + 1))
        s_start = base_date + timedelta(weeks=wk_start - 1)
        s_end = base_date + timedelta(weeks=wk_end)

        for si, step in enumerate(card.get('how_to_practice', [])):
            group, cat = _classify_activity(step)
            results['activities'].append({
                'id': str(uuid.uuid4()),
                'playbook_id': playbook_id,
                'member_id': member_id,
                'goal_id': str(uuid.uuid4()),
                'title': _clean_title(step)[:80],
                'category': cat,
                'activity_group': group,
                'range_start': _extract_number(step),
                'range_unit': _extract_activity_unit(step),
                'frequency': 1,
                'recurrence': 'daily',
                'notes': step,
                'sequence': si + 1,
                'start_date': s_start.strftime('%Y-%m-%d'),
                'end_date': s_end.strftime('%Y-%m-%d'),
                'status': 'draft',
                'generated_by': 'playbook_ai',
                'weeks': weeks,
            })

    # General guidelines (extracted from across all cards)
    guidelines = _extract_guidelines(biweekly)
    for gi, g in enumerate(guidelines):
        results['guidelines'].append({
            'id': str(uuid.uuid4()),
            'playbook_id': playbook_id,
            'member_id': member_id,
            'title': g['title'],
            'category': g['category'],
            'sequence': gi + 1,
            'status': 'draft',
            'generated_by': 'playbook_ai',
            'weeks': list(range(1, 49)),
        })

    return results


# ── Helper functions ──

def _parse_supplement_step(step: str) -> dict:
    """Parse a supplement line like '1. L-Carnitine (ALCAR) 1000mg - morning, with food'"""
    # Remove leading number
    s = re.sub(r'^\d+\.\s*', '', step).strip()
    if len(s) < 5:
        return None
    # Skip non-supplement lines
    skip = ['all previous', 'safety', 'discontinue', 'total supplements', 'continue']
    if any(k in s.lower() for k in skip):
        return None

    name = s.split(' - ')[0].split('(')[0].strip() if ' - ' in s else s.split(',')[0].strip()
    dose_m = re.search(r'(\d+\.?\d*)\s*(mg|mcg|IU|g|ml|capsule|tablet|scoop)', s, re.IGNORECASE)
    time = 'morning' if 'morning' in s.lower() else 'evening' if 'evening' in s.lower() or 'bed' in s.lower() else 'morning'
    timing = 'pre_meal' if 'empty' in s.lower() or 'before' in s.lower() else 'with_meal' if 'with' in s.lower() else 'post_meal'
    form = 'capsule'
    if 'scoop' in s.lower(): form = 'scoop'
    elif 'tablet' in s.lower(): form = 'tablet'
    elif 'powder' in s.lower(): form = 'powder'

    return {
        'name': name[:60],
        'dose': dose_m.group(0) if dose_m else '',
        'unit': dose_m.group(2) if dose_m else '',
        'time': time,
        'timing': timing,
        'form': form,
        'notes': s,
    }


def _classify_nutrition(step: str) -> str:
    s = step.lower()
    if any(k in s for k in ['eliminate', 'remove', 'avoid', 'stop', 'reduce', 'cut']):
        return 'elimination'
    if any(k in s for k in ['add', 'include', 'introduce', 'start']):
        return 'addition'
    if any(k in s for k in ['water', 'hydrat', 'drink', 'liquid']):
        return 'hydration'
    if any(k in s for k in ['meal', 'breakfast', 'lunch', 'dinner', 'timing']):
        return 'meal_framework'
    if any(k in s for k in ['fiber', 'fibre', 'prebiotic', 'ferment', 'probiotic', 'gut']):
        return 'digestive_support'
    if any(k in s for k in ['rice', 'roti', 'dal', 'grain', 'millet', 'wheat']):
        return 'food_base'
    return 'addition'


def _extract_food_samples(step: str) -> list:
    foods = re.findall(r'(?:palak|methi|ragi|jowar|bajra|dal|paneer|curd|ghee|amla|turmeric|moringa|flaxseed|chia|walnut|almond|broccoli|spinach|cabbage|beetroot|carrot|pumpkin)', step.lower())
    return [{'title': f.capitalize()} for f in set(foods)] if foods else [{'title': step[:40]}]


def _classify_sleep(step: str) -> str:
    s = step.lower()
    if any(k in s for k in ['screen', 'phone', 'device']): return 'screen_curfew'
    if any(k in s for k in ['temperature', 'cool', 'dark']): return 'temperature'
    if any(k in s for k in ['caffeine', 'coffee', 'tea']): return 'caffeine'
    if any(k in s for k in ['bed', 'time', 'routine']): return 'bedtime_routine'
    if any(k in s for k in ['sunlight', 'morning', 'light']): return 'circadian'
    return 'other'


def _classify_stress(card: dict) -> str:
    text = ' '.join(card.get('how_to_practice', [])).lower()
    if 'box breath' in text: return 'stress_box_breathing'
    if 'nadi' in text: return 'stress_nadi_shodhana'
    if 'yoga nidra' in text: return 'stress_yoga_nidra'
    if 'meditat' in text: return 'stress_meditation'
    if 'journal' in text: return 'stress_journaling'
    return 'stress_breathwork'


def _classify_activity(step: str) -> tuple:
    s = step.lower()
    if any(k in s for k in ['walk', 'step']): return ('neat', 'activities_walking')
    if any(k in s for k in ['yoga', 'stretch', 'flexibility']): return ('mobility', 'activities_yoga')
    if any(k in s for k in ['push', 'squat', 'plank', 'deadlift', 'dumbbell', 'resistance', 'weight']): return ('strength', 'activities_strength')
    if any(k in s for k in ['zone 2', 'cardio', 'run', 'swim', 'cycle', 'interval']): return ('cardio', 'activities_cardio')
    return ('neat', 'activities_general')


def _extract_duration(steps: list) -> int:
    for s in steps:
        m = re.search(r'(\d+)\s*min', s)
        if m: return int(m.group(1))
    return 10


def _extract_number(step: str) -> str:
    m = re.search(r'(\d+)', step)
    return m.group(1) if m else None


def _extract_activity_unit(step: str) -> str:
    s = step.lower()
    if 'step' in s: return 'steps'
    if 'min' in s: return 'mins'
    if 'rep' in s: return 'reps'
    if 'set' in s: return 'sets'
    return 'mins'


def _clean_title(step: str) -> str:
    t = re.sub(r'^\d+\.\s*', '', step).strip()
    t = re.sub(r'\s*\(.*?\)', '', t)
    t = t.split(':')[0].strip() if ':' in t else t.split('-')[0].strip() if ' - ' in t else t
    return t[:80]


def _extract_guidelines(biweekly: dict) -> list:
    guides = []
    seen = set()
    all_steps = []
    for comp in biweekly.values():
        if isinstance(comp, list):
            for card in comp:
                if isinstance(card, dict):
                    all_steps.extend(card.get('how_to_practice', []))

    for step in all_steps:
        s = step.lower()
        if 'no screen' in s and 'screen_curfew' not in seen:
            guides.append({'title': 'No Screens Before Bed', 'category': 'general_guides_screen_curfew'})
            seen.add('screen_curfew')
        if ('12' in s or '13' in s or '14' in s) and 'fast' in s and 'fasting' not in seen:
            guides.append({'title': 'Start 12-Hour Overnight Fast Daily', 'category': 'general_guides_12_hr_eating_window'})
            seen.add('fasting')
        if 'gluten' in s and 'gluten' not in seen:
            guides.append({'title': 'Avoid Gluten', 'category': 'general_guides_avoid_gluten'})
            seen.add('gluten')

    return guides
