#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
from textwrap import dedent

module=Path(__file__).resolve().parents[1]/'tools'/'wram-delta-audit.py'
spec=importlib.util.spec_from_file_location('audit_wram',module);audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
header='frame,address,old,new,changed_total,shown,baseline\n'
with tempfile.TemporaryDirectory() as tmp:
    a=Path(tmp)/'a.csv';b=Path(tmp)/'b.csv'
    a.write_text(header+'100,,,,0,0,1\n101,7E0010,01,02,2,1,0\n102,7E0010,02,03,1,1,0\n')
    b.write_text(header+'100,,,,0,0,1\n101,7E0010,01,02,1,1,0\n102,7E0011,02,03,1,1,0\n')
    report=audit.analyze(a,b)
    assert report['samples_a']==3
    assert report['truncated_samples_a']==1
    assert report['first_observed_delta_difference']['frame']==102
    assert report['first_observed_delta_difference']['comparison_complete']
    assert report['hot_addresses_a'][0]['address']=='7E0010'
    assert report['gameplay_verified'] is False
    print('PASS valid report, truncation, first difference, hotspot, fail-closed gameplay')
    for label,text in (
        ('duplicate',header+'1,7E0001,01,02,2,2,0\n1,7E0001,02,03,2,2,0\n'),
        ('bad-address',header+'1,7D0001,01,02,1,1,0\n'),
        ('bad-byte',header+'1,7E0001,01,GG,1,1,0\n'),
        ('order',header+'2,,,,0,0,1\n1,,,,0,0,1\n'),
        ('truncated-row',header+'1,7E0001,01,02,2,2,0\n'),
        ('baseline-change',header+'1,7E0001,01,02,1,1,1\n'),
    ):
        a.write_text(text)
        try:audit.load(a)
        except ValueError:pass
        else:raise AssertionError(label)
        print('PASS rejects',label)
