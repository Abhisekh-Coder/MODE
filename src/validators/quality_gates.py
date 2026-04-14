"""MODE — Quality Gate Validators"""

def validate_agent1(output, input_biomarkers):
    checks = []
    all_out = [m for s in output.get('sections',[]) for m in s.get('markers',[])]
    non_opt = input_biomarkers.get('non_optimal_count', 0)
    personalized = sum(1 for m in all_out if m['status'] != 'Optimal' and len(m.get('implication','')) > 50)
    checks.append({'name': 'Non-optimal implications', 'pass': personalized >= non_opt * 0.95, 'detail': f'{personalized}/{non_opt}'})
    
    inp_names = {m['biomarker'] for m in input_biomarkers.get('all_markers',[])}
    out_names = {m['biomarker'] for m in all_out}
    invented = out_names - inp_names
    checks.append({'name': 'No invented markers', 'pass': len(invented)==0, 'detail': f'Invented: {invented}' if invented else 'Clean'})
    
    handoff = output.get('cluster_handoff', '')
    checks.append({'name': 'Handoff present', 'pass': len(handoff) > 100, 'detail': f'{len(handoff)} chars'})
    for i in range(1, 9):
        checks.append({'name': f'C{i} defined', 'pass': f'C{i}' in handoff})
    return checks

def validate_agent2(output):
    checks = []
    systems = output.get('systems', [])
    checks.append({'name': '9 systems', 'pass': len(systems)==9, 'detail': f'{len(systems)}'})
    ranges = {'key_insights':(1200,1800), 'root_cause':(590,1450), 'clinical_implications':(270,830), 'clarity_card':(730,850)}
    for s in systems:
        for field,(lo,hi) in ranges.items():
            l = len(s.get(field,''))
            checks.append({'name': f'{s["name"]}: {field}', 'pass': lo<=l<=hi, 'detail': f'{l} ({lo}-{hi})'})
    return checks

def validate_agent3(output):
    checks = []
    raw = str(output)
    for el in ['POTENTIAL FOXO SYSTEM IMPACT','WHY IT WORKS','HOW TO PUT IT INTO PRACTICE','WHAT TO EXPECT']:
        c = raw.count(el)
        checks.append({'name': f'Cards: {el}', 'pass': c >= 25, 'detail': f'{c} found'})
    checks.append({'name': 'No (System:) tags', 'pass': raw.count('(System:') == 0})
    checks.append({'name': 'FOXO SYSTEM IMPACT label', 'pass': raw.count('BIOMARKER IMPACT') == 0})
    return checks
