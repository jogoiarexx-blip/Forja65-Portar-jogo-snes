from migrate_legacy_rtl import migrate
BASE='''{ auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBCE5ADu);return;} hw.unresolvedReturn(0xBCE5ADu,dst,cpu,"STACK-RTL"); } }'''
s,count=migrate(BASE)
assert count==1
assert 'if(hw.consumeConstructedLongReturn(dst,cpu)){cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBCE5ADu);return;}' in s
assert migrate(s)==(s,0)
assert migrate(BASE.replace('true,cpu','false,cpu'))[1]==0
for pop in ('cpu.popLongReturn(hw);','cpu.dropStack(3u,true);'):
    t,c=migrate(BASE.replace('cpu.pop16Value(hw);cpu.pop8Value(hw);',pop))
    assert c==1 and t.count(pop)==2
print('LEGACY_RTL_MIGRATION_PASS idempotent guarded preserved three-stack-variants')
