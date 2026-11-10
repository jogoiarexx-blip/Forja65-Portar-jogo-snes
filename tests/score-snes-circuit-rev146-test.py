import importlib.util,pathlib,tempfile
source=pathlib.Path(__file__).resolve().parents[1]/'tools/score-snes-circuit-rev146.py'
spec=importlib.util.spec_from_file_location('score',source)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
with tempfile.TemporaryDirectory() as tmp:
    evidence=pathlib.Path(tmp)/'hud.ppm';evidence.write_text('P3\n1 1\n255\n0 0 0\n')
    five={'completed_laps':True,'max_lap_observed':5}
    assert mod.grade(five,3,evidence)['status']=='QUALIFIED'
    assert mod.grade(five,6,evidence)['status']=='FINISHED_UNQUALIFIED'
    assert mod.grade(five,None,evidence)['status']=='FINISHED_RANK_UNVERIFIED'
    assert mod.grade({'completed_laps':False,'max_lap_observed':5},3,evidence)['status']=='NOT_FINISHED'
    for bad in (-1,0,9,99):
        try:mod.grade(five,bad,evidence)
        except ValueError:pass
        else:raise AssertionError('accepted invalid rank '+str(bad))
    try:mod.grade(five,3,pathlib.Path(tmp)/'missing.png')
    except ValueError:pass
    else:raise AssertionError('accepted rank without evidence')
print('SCORE_SNES_CIRCUIT_REV146_PASS 9 scenarios')
