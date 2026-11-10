#include "forja_trace.hpp"
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <string>

int main(int argc, char** argv) {
  if(argc!=2) return 2;
  try {
    ForjaBusClockTrace trace;
    trace.start(argv[1],2);
    trace.emit(0,2,0x808010,"read","CPU",0x7e0010,0x12);
    trace.emit(8,2,0x808012,"write","CPU",0x7e0010,0x34);
    trace.emit(16,2,0x808014,"read","DMA",0x2100,0xFF);
    if(trace.written!=2 || trace.dropped!=1) return 3;
    trace.close();
    std::ifstream in(argv[1]);
    std::string line, all;
    while(std::getline(in,line)) all+=line+'\n';
    if(all.find("bus_microcycle_accurate=false")==std::string::npos) return 4;
    if(all.find("0,0,2,8421392,read,CPU,8257552,18,unknown")==std::string::npos) return 5;
    if(all.find("1,8,2,8421394,write,CPU,8257552,52,unknown")==std::string::npos) return 6;
    if(all.find("# written=2 dropped=1")==std::string::npos) return 7;
    bool rejected=false;
    trace.start(argv[1]);
    trace.emit(12,2,0x808010,"read","CPU",0,0);
    try{trace.emit(11,2,0x808010,"read","CPU",0,0);}catch(const std::runtime_error&){rejected=true;}
    trace.close();
    if(!rejected) return 8;
    std::cout << "FORJA65_BUS_CLOCK_TRACE_PASS\n";
    return 0;
  } catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
