#include "runtime.hpp"
#include <cassert>
#include <iostream>
int main(){SnesRuntime h;CpuState c;c.enforceEmulation();
 c.push16Value(h,0x8122);h.pushNativeReturn(0x8123,false,c);
 assert(h.nativeReturnMatches(0x8123,false,c));
 // A PEA-style trampoline uses a different physical stack slot even if its
 // destination coincides with the outer JSR's continuation.
 c.push16Value(h,0x8122);
 assert(!h.nativeReturnMatches(0x8123,false,c));
 auto before=h.nativeReturns.size();h.retireRedirectedNativeReturn(c,false);
 assert(h.nativeReturns.size()==before);c.pop16Value(h);
 assert(h.nativeReturnMatches(0x8123,false,c));
 // Authorized redirect at the real call frame removes its bookkeeping.
 h.retireRedirectedNativeReturn(c,false);c.pop16Value(h);
 assert(h.nativeReturns.empty()&&c.s==0x1ff);
 // Nested calls, repeating destinations: retire exactly the active slot.
 c.e=false;c.s=0x1234;c.push16Value(h,0x9000);h.pushNativeReturn(0x9001,false,c);
 c.push16Value(h,0x9000);h.pushNativeReturn(0x9001,false,c);
 h.retireRedirectedNativeReturn(c,false);c.pop16Value(h);
 assert(h.nativeReturns.size()==1&&h.nativeReturnMatches(0x9001,false,c));
 h.retireRedirectedNativeReturn(c,false);c.pop16Value(h);
 assert(h.nativeReturns.empty()&&c.s==0x1234);
 // No numeric ordering assumption: native stack can wrap through zero.
 c.s=1;c.push16Value(h,0x7777);assert(c.s==0xffff);h.pushNativeReturn(0x7778,false,c);
 h.retireRedirectedNativeReturn(c,false);c.pop16Value(h);assert(c.s==1&&h.nativeReturns.empty());
 std::cout<<"stack-position guard PASS PEA/nested/wrap\n";
}
