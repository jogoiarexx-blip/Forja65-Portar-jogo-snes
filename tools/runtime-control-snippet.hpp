// ---- Forja65 REV134: modo de controle remoto (FORJA65_CONTROL=1) ----------------------------------
// O port vira um "emulador controlavel" por stdin/stdout, quadro a quadro, com savestates instantaneos
// por fork() (Linux/macOS). Serve para gerar entradas (busca automatica de rotas, bonus, mini-jogos)
// diretamente no proprio port, sem depender da temporizacao de outro emulador.
// Protocolo (uma linha por comando; resposta em uma linha):
//   run N MASK   roda N quadros com joypad 1 = MASK (hex, bits de $4218)  -> "ok <quadro>"
//   ram ADDR LEN WRAM (hex) a partir de ADDR (offset 0..1FFFF)             -> hex
//   frame                                                                  -> numero do quadro
//   save ID / load ID / del ID   savestate por processo pausado (fork)    -> "ok"
//   shot PATH    grava o quadro atual em PPM                               -> "ok"
//   quit
#if !defined(_WIN32)
#include <unistd.h>
#include <signal.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <dirent.h>
#include <cerrno>
inline std::string forja65ControlDir(){
  static std::string d=[](){const char*e=std::getenv("FORJA65_CONTROL_DIR");std::string p=e&&*e?e:("/tmp/forja65-control-"+std::to_string((long)getpid()));mkdir(p.c_str(),0700);return p;}();
  return d;
}
// Leitura de linha sem buffer (byte a byte em fd 0): apos "load" o processo restaurado nao pode herdar
// um buffer de stdin antigo (com comandos ja consumidos), senao repetiria comandos quando a entrada vem por pipe.
inline std::string forja65ControlReadPtr(const std::string&p){std::string r;int fd=::open(p.c_str(),O_RDONLY);if(fd<0)return r;char b[512];ssize_t n=::read(fd,b,sizeof b);::close(fd);if(n>0)r.assign(b,(std::size_t)n);return r;}
inline void forja65ControlWritePtr(const std::string&p,const std::string&v){const std::string t=p+".tmp";int fd=::open(t.c_str(),O_WRONLY|O_CREAT|O_TRUNC,0600);if(fd<0)return;(void)!::write(fd,v.data(),v.size());::close(fd);::rename(t.c_str(),p.c_str());}
// Envia 1 byte ao guardiao do FIFO sem travar: tenta abrir sem bloquear por ate "ms" milissegundos
// (o guardiao pode estar entre duas leituras). Falha = guardiao inexistente.
inline bool forja65ControlSend(const std::string&f,char b,int ms){for(int t=0;t<=ms;++t){int fd=::open(f.c_str(),O_WRONLY|O_NONBLOCK);if(fd>=0){(void)!::write(fd,&b,1);::close(fd);return true;}if(errno!=ENXIO)return false;usleep(1000);}return false;}
inline bool forja65ControlReadLine(char*out,std::size_t cap){std::size_t n=0;char ch;for(;;){ssize_t r=::read(0,&ch,1);if(r<=0)return n>0?(out[n]=0,true):false;if(ch=='\n')break;if(n+1<cap)out[n++]=ch;}out[n]=0;return true;}
inline void SnesRuntime::controlFrame(){
  static bool first=true;
  if(first){first=false;signal(SIGCHLD,SIG_IGN);replayActive=true;inputReplay.clear();std::printf("ready %llu\n",(unsigned long long)frameCounter);std::fflush(stdout);}
  else if(controlRunLeft>0){if(--controlRunLeft>0)return;std::printf("ok %llu\n",(unsigned long long)frameCounter);std::fflush(stdout);}
  char line[512];
  while(forja65ControlReadLine(line,sizeof line)){
    std::istringstream in(line);std::string c;in>>c;if(c.empty())continue;
    if(c=="run"){unsigned long long n=0;std::string m;in>>n>>m;io.joy[0]=(std::uint16_t)std::strtoul(m.c_str(),nullptr,16);
      if(n==0){std::printf("ok %llu\n",(unsigned long long)frameCounter);std::fflush(stdout);continue;}controlRunLeft=n;return;}
    if(c=="ram"){unsigned a=0,n=0;in>>std::hex>>a>>n;std::string o;o.reserve(n*2);char b[3];for(unsigned k=0;k<n;k++){std::snprintf(b,3,"%02x",ram[(a+k)&0x1FFFFu]);o+=b;}std::printf("%s\n",o.c_str());std::fflush(stdout);continue;}
    if(c=="frame"){std::printf("%llu\n",(unsigned long long)frameCounter);std::fflush(stdout);continue;}
    if(c=="shot"){std::string p;in>>p;writeFramePpm(p);std::printf("ok\n");std::fflush(stdout);continue;}
    if(c=="save"){std::string id;in>>id;
      // REV135: cada savestate tem um FIFO de nome unico (ID.pid.n) e um arquivo-ponteiro "snap-ID" com o nome
      // atual. Reusar o mesmo nome deixava o guardiao antigo reabrir o FIFO novo (dois leitores): um "load"
      // podia restaurar o estado velho ou travar. O guardiao antigo recebe 'X' ou sai ao ver o nome removido.
      const std::string ptr=forja65ControlDir()+"/snap-"+id;const std::string old=forja65ControlReadPtr(ptr);
      if(!old.empty()){forja65ControlSend(old,'X',50);unlink(old.c_str());}
      static unsigned long long gen=0;const std::string fifo=forja65ControlDir()+"/fifo-"+id+"."+std::to_string((long)getpid())+"."+std::to_string(++gen);
      unlink(fifo.c_str());mkfifo(fifo.c_str(),0600);forja65ControlWritePtr(ptr,fifo);
      std::fflush(stdout);pid_t child=fork();
      if(child==0){ // processo pausado: guarda o estado ate receber 'R' (retomar) ou 'X' (descartar)
        for(;;){int fd=::open(fifo.c_str(),O_RDONLY);if(fd<0)_exit(0);char b=0;ssize_t r=::read(fd,&b,1);::close(fd);
          if(r==1&&b=='X')_exit(0);
          if(r==1&&b=='R'){pid_t g=fork();if(g==0){std::printf("ok %llu\n",(unsigned long long)frameCounter);std::fflush(stdout);goto resumed;}}
        }
      }
      std::printf("ok\n");std::fflush(stdout);continue;
      resumed:continue;}
    if(c=="load"||c=="del"){std::string id;in>>id;const std::string ptr=forja65ControlDir()+"/snap-"+id;const std::string fifo=forja65ControlReadPtr(ptr);
      const char b=c=="load"?'R':'X';
      if(fifo.empty()||!forja65ControlSend(fifo,b,3000)){std::printf("err\n");std::fflush(stdout);continue;}
      if(c=="load")_exit(0); // o processo restaurado assume o controle e responde "ok"
      unlink(fifo.c_str());unlink(ptr.c_str());std::printf("ok\n");std::fflush(stdout);continue;}
    if(c=="quit")break;
    std::printf("err cmd\n");std::fflush(stdout);
  }
  // encerra: descarta snapshots pausados desta sessao
  if(DIR*d=opendir(forja65ControlDir().c_str())){while(dirent*en=readdir(d)){std::string n=en->d_name;const std::string p=forja65ControlDir()+"/"+n;
    if(n.rfind("fifo-",0)==0){forja65ControlSend(p,'X',20);unlink(p.c_str());}else if(n.rfind("snap-",0)==0)unlink(p.c_str());}closedir(d);}
  _exit(0);
}
#else
inline void SnesRuntime::controlFrame(){}
#endif
