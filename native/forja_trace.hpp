#ifndef FORJA_TRACE_HPP
#define FORJA_TRACE_HPP
#include <cstdint>
#include <cstdlib>
#include <fstream>
#include <string>
#include <stdexcept>
#ifndef FORJA65_ENABLE_TRACE
#define FORJA65_ENABLE_TRACE 1
#endif
// No observer performs a bus read. Disabled builds perform no file or event work.
struct ForjaTrace {
#if FORJA65_ENABLE_TRACE
  std::ofstream out;
  std::uint64_t sequence{},written{},dropped{},limit{250000};
  bool enabled{};
  void start(const std::string&path,const std::string&rom,std::uint64_t cap=250000){close();out.open(path,std::ios::trunc);if(!out)throw std::runtime_error("Cannot open ForjaTrace: "+path);sequence=written=dropped=0;limit=cap;enabled=true;out<<"# FORJA_TRACE 1 rom="<<rom<<"\nseq,frame,routine,pc,kind,space,address,value,source\n";}
  void initialize(const std::string&rom){const char*p=std::getenv("FORJA65_TRACE");if(!p||!*p||std::string(p)=="0")return;std::uint64_t cap=250000;if(const char*c=std::getenv("FORJA65_TRACE_LIMIT")){try{cap=std::stoull(c);}catch(...){throw std::runtime_error("Invalid FORJA65_TRACE_LIMIT");}}start(std::string(p)=="1"?"forja-trace.csv":p,rom,cap);}
  void emit(std::uint64_t frame,std::uint32_t routine,std::uint32_t pc,const char*kind,const char*space,std::uint32_t address,std::uint64_t value,const char*source="CPU"){if(!enabled)return;const auto seq=sequence++;if(written>=limit){dropped++;return;}out<<seq<<','<<frame<<','<<routine<<','<<pc<<','<<kind<<','<<space<<','<<address<<','<<value<<','<<source<<'\n';if(!out)throw std::runtime_error("ForjaTrace write failed");written++;}
  void close(){if(out.is_open()){out<<"# written="<<written<<" dropped="<<dropped<<'\n';out.close();}enabled=false;}
#else
  static constexpr bool enabled=false;
  void start(const std::string&,const std::string&,std::uint64_t=250000){}
  void initialize(const std::string&){}
  void emit(std::uint64_t,std::uint32_t,std::uint32_t,const char*,const char*,std::uint32_t,std::uint64_t,const char* = "CPU"){}
  void close(){}
#endif
  ~ForjaTrace(){close();}
};
// Captures the runtime scheduler's existing elapsed master-clock counter.
// This is NOT a bus microcycle oracle: several memory accesses performed in
// one translated instruction can share the same timestamp, and dummy status
// remains unknown except for CPU RMW reads and final writes that the
// instruction implementation explicitly identifies as non-dummy.
struct ForjaBusClockTrace {
#if FORJA65_ENABLE_TRACE
  std::ofstream out;
  std::uint64_t sequence{}, written{}, dropped{}, limit{250000}, lastCycle{};
  bool enabled{}, hasCycle{};
  void start(const std::string& path, std::uint64_t cap=250000) {
    close();
    out.open(path, std::ios::out|std::ios::trunc);
    if (!out) throw std::runtime_error("Cannot open ForjaBusClockTrace: " + path);
    sequence=written=dropped=lastCycle=0;
    hasCycle=false;limit=cap;enabled=true;
    out << "# FORJA_BUS_CLOCK_TRACE 1 timing_basis=runtime_scheduler_clock "
           "bus_microcycle_accurate=false dummy_classification=explicit_rmw_only\n"
           "seq,master_cycle,frame,pc,kind,source,address,value,dummy\n";
  }
  void initialize() {
    const char* path=std::getenv("FORJA65_BUS_CLOCK_TRACE");
    if (!path || !*path || std::string(path)=="0") return;
    std::uint64_t cap=250000;
    if (const char* text=std::getenv("FORJA65_BUS_CLOCK_TRACE_LIMIT")) {
      try { cap=std::stoull(text); }
      catch (...) { throw std::runtime_error("Invalid FORJA65_BUS_CLOCK_TRACE_LIMIT"); }
    }
    start(std::string(path)=="1" ? "forja-bus-clock.csv" : path,cap);
  }
  void emit(std::uint64_t clock,std::uint64_t frame,std::uint32_t pc,
            const char*kind,const char*source,std::uint32_t address,std::uint32_t value,
            const char*dummy="unknown") {
    if (!enabled) return;
    if (std::string(dummy)!="unknown" && std::string(dummy)!="false" && std::string(dummy)!="true")
      throw std::invalid_argument("Invalid dummy bus classification");
    if (hasCycle && clock<lastCycle) throw std::runtime_error("Bus clock went backwards");
    lastCycle=clock;hasCycle=true;
    const auto seq=sequence++;
    if (written>=limit) {++dropped;return;}
    out << seq << ',' << clock << ',' << frame << ',' << (pc&0xFFFFFFu)
        << ',' << kind << ',' << source << ',' << (address&0xFFFFFFu) << ',' << (value&0xFFu) << "," << dummy << "\n";
    if (!out) throw std::runtime_error("ForjaBusClockTrace write failed");
    ++written;
  }
  void close() {
    if(out.is_open()) {out << "# written="<<written<<" dropped="<<dropped<<'\n';out.close();}
    enabled=false;
  }
#else
  static constexpr bool enabled=false;
  void start(const std::string&,std::uint64_t=250000) {}
  void initialize() {}
  void emit(std::uint64_t,std::uint64_t,std::uint32_t,const char*,const char*,std::uint32_t,std::uint32_t,const char* = "unknown") {}
  void close() {}
#endif
  ~ForjaBusClockTrace() {close();}
};

struct ForjaTraceContext {
  std::uint32_t&routine;const char*&source;std::uint32_t oldRoutine;const char*oldSource;
  ForjaTraceContext(std::uint32_t&r,const char*&s,std::uint32_t next,const char*origin):routine(r),source(s),oldRoutine(r),oldSource(s){routine=next;source=origin;}
  ~ForjaTraceContext(){routine=oldRoutine;source=oldSource;}
};

#endif
