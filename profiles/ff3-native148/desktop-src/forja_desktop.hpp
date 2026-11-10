#pragma once
#include <algorithm>
#include <cstdint>
#include <fstream>
#include <functional>
#include <sstream>
#include <string>
#include <vector>
#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif
namespace forja148 {
enum class Action {None,Save,Load,Restart,Quit};
struct Request {Action action=Action::None;int slot=1;};
inline Request pending;
struct Settings {int volume=100,filter=0,zoom=0,slot=1;bool mute=false,fullscreen=false;};
inline void sanitize(Settings& s){s.volume=std::clamp(s.volume,0,100);if(s.filter<0||s.filter>2)s.filter=0;if(s.zoom<0||s.zoom>6)s.zoom=0;if(s.slot<1||s.slot>5)s.slot=1;}
inline Settings loadSettings(const std::string& p){Settings s;std::ifstream in(p);std::string l;while(std::getline(in,l)){auto eq=l.find('=');if(eq==std::string::npos)continue;auto k=l.substr(0,eq);int n;char tail;std::istringstream v(l.substr(eq+1));if(!(v>>n)||(v>>tail))continue;if(k=="volume")s.volume=n;else if(k=="filter")s.filter=n;else if(k=="zoom")s.zoom=n;else if(k=="slot")s.slot=n;else if(k=="mute"&&(n==0||n==1))s.mute=n;else if(k=="fullscreen"&&(n==0||n==1))s.fullscreen=n;}sanitize(s);return s;}
inline bool saveSettings(const std::string& p,Settings s){sanitize(s);std::ofstream o(p,std::ios::trunc);o<<"volume="<<s.volume<<"\nfilter="<<s.filter<<"\nzoom="<<s.zoom<<"\nslot="<<s.slot<<"\nmute="<<int(s.mute)<<"\nfullscreen="<<int(s.fullscreen)<<'\n';o.flush();return bool(o);}
inline std::vector<std::uint32_t> filterFrame(const std::vector<std::uint32_t>& v,unsigned w,unsigned h,int filter){auto out=v;if(filter==2&&w&&std::size_t(w)*h<=out.size())for(unsigned y=1;y<h;y+=2)for(unsigned x=0;x<w;x++){auto& p=out[std::size_t(y)*w+x];p=(p&0xff000000u)|((p&0xfefefeu)>>1);}return out;}
struct Desktop {
 Desktop()=default;Desktop(const Desktop&)=delete;Desktop& operator=(const Desktop&)=delete;
 Settings settings=loadSettings("forja65-settings.ini");std::function<void(bool)> pause;std::string status;
#ifdef _WIN32
 HDC back=nullptr;HBITMAP bitmap=nullptr;HGDIOBJ previous=nullptr;int bw=0,bh=0;
 bool full=false;RECT oldRect{};LONG_PTR oldStyle=0;unsigned fw=256,fh=224;
 ~Desktop(){release();}
 void release(){if(back&&previous)SelectObject(back,previous);if(bitmap)DeleteObject(bitmap);if(back)DeleteDC(back);back=nullptr;bitmap=nullptr;previous=nullptr;bw=bh=0;}
 void attach(HWND h){full=false;release();applyWindow(h);}
 void applyWindow(HWND h){if(!h)return;if(settings.fullscreen&&!full){GetWindowRect(h,&oldRect);oldStyle=GetWindowLongPtr(h,GWL_STYLE);MONITORINFO m{};m.cbSize=sizeof(m);GetMonitorInfo(MonitorFromWindow(h,MONITOR_DEFAULTTONEAREST),&m);SetWindowLongPtr(h,GWL_STYLE,oldStyle&~LONG_PTR(WS_OVERLAPPEDWINDOW));SetWindowPos(h,HWND_TOP,m.rcMonitor.left,m.rcMonitor.top,m.rcMonitor.right-m.rcMonitor.left,m.rcMonitor.bottom-m.rcMonitor.top,SWP_FRAMECHANGED);full=true;}else if(!settings.fullscreen&&full){SetWindowLongPtr(h,GWL_STYLE,oldStyle);SetWindowPos(h,nullptr,oldRect.left,oldRect.top,oldRect.right-oldRect.left,oldRect.bottom-oldRect.top,SWP_FRAMECHANGED|SWP_NOZORDER);full=false;}if(!full&&settings.zoom){RECT r{0,0,LONG(fw*settings.zoom),LONG(fh*settings.zoom)};AdjustWindowRect(&r,DWORD(GetWindowLongPtr(h,GWL_STYLE)),FALSE);SetWindowPos(h,nullptr,0,0,r.right-r.left,r.bottom-r.top,SWP_NOMOVE|SWP_NOZORDER);}}
 void command(unsigned id,HWND h){if(id>=101&&id<=105){settings.slot=int(id)-100;pending={Action::Save,settings.slot};}else if(id>=111&&id<=115){settings.slot=int(id)-110;pending={Action::Load,settings.slot};}else if(id>=121&&id<=125)settings.slot=int(id)-120;else if(id>=201&&id<=205)settings.volume=(int(id)-201)*25;else if(id==206)settings.mute=!settings.mute;else if(id>=301&&id<=303)settings.filter=int(id)-301;else if(id>=400&&id<=406){settings.zoom=int(id)-400;applyWindow(h);}else if(id==410){settings.fullscreen=!settings.fullscreen;applyWindow(h);}else if(id==500)pending={Action::Restart,settings.slot};else if(id==501)pending={Action::Quit,settings.slot};if(!saveSettings("forja65-settings.ini",settings))status="Nao foi possivel gravar as preferencias";}
 void menu(HWND h){if(pause)pause(true);struct Resume{std::function<void(bool)>& f;~Resume(){if(f)f(false);}} resume{pause};HMENU m=CreatePopupMenu();if(!m)return;auto item=[](HMENU a,unsigned id,const std::string& text,bool check=false){AppendMenuA(a,MF_STRING|(check?MF_CHECKED:0),id,text.c_str());};item(m,1,"Continuar (Esc)");if(!status.empty())AppendMenuA(m,MF_STRING|MF_GRAYED,0,status.c_str());HMENU save=CreatePopupMenu(),load=CreatePopupMenu(),slot=CreatePopupMenu();for(int i=1;i<=5;i++){auto name="Slot "+std::to_string(i);item(save,100+i,name);item(load,110+i,name);item(slot,120+i,name,settings.slot==i);}AppendMenuA(m,MF_POPUP,reinterpret_cast<UINT_PTR>(save),"Salvar estado (F6)");AppendMenuA(m,MF_POPUP,reinterpret_cast<UINT_PTR>(load),"Carregar estado (F9)");AppendMenuA(m,MF_POPUP,reinterpret_cast<UINT_PTR>(slot),"Slot rapido");HMENU audio=CreatePopupMenu();item(audio,206,"Silenciar",settings.mute);for(int i=0;i<5;i++)item(audio,201+i,std::to_string(i*25)+"%",settings.volume==i*25);AppendMenuA(m,MF_POPUP,reinterpret_cast<UINT_PTR>(audio),"Audio");HMENU filters=CreatePopupMenu();const char* names[]={"Pixels nitidos","Suave","Scanlines"};for(int i=0;i<3;i++)item(filters,301+i,names[i],settings.filter==i);AppendMenuA(m,MF_POPUP,reinterpret_cast<UINT_PTR>(filters),"Filtro grafico");HMENU zoom=CreatePopupMenu();item(zoom,400,"Ajustar",settings.zoom==0);for(int i=1;i<=6;i++)item(zoom,400+i,std::to_string(i)+"x",settings.zoom==i);AppendMenuA(m,MF_POPUP,reinterpret_cast<UINT_PTR>(zoom),"Tamanho da janela");item(m,410,"Tela cheia (F11)",settings.fullscreen);AppendMenuA(m,MF_SEPARATOR,0,nullptr);item(m,500,"Reiniciar (F5)");item(m,501,"Sair");RECT r{};GetWindowRect(h,&r);SetForegroundWindow(h);const auto id=TrackPopupMenu(m,TPM_RETURNCMD|TPM_NONOTIFY|TPM_CENTERALIGN,(r.left+r.right)/2,(r.top+r.bottom)/2,0,h,nullptr);DestroyMenu(m);if(id)command(id,h);}
 bool message(const MSG& m,HWND h){if(m.message!=WM_KEYDOWN&&m.message!=WM_SYSKEYDOWN)return false;auto k=m.wParam;if(k!=VK_ESCAPE&&k!=VK_F6&&k!=VK_F9&&k!=VK_F11)return false;if(m.lParam&(LPARAM(1)<<30))return true;if(k==VK_ESCAPE)menu(h);else if(k==VK_F6)pending={Action::Save,settings.slot};else if(k==VK_F9)pending={Action::Load,settings.slot};else command(410,h);return true;}
 void paint(HWND h,const std::vector<std::uint32_t>& pixels,unsigned w,unsigned height){if(!h||!w||!height||std::size_t(w)*height>pixels.size())return;fw=w;fh=height;RECT r{};GetClientRect(h,&r);int cw=r.right,ch=r.bottom;if(cw<=0||ch<=0)return;HDC screen=GetDC(h);if(!screen)return;if(!back||cw!=bw||ch!=bh){release();back=CreateCompatibleDC(screen);if(back)bitmap=CreateCompatibleBitmap(screen,cw,ch);if(!back||!bitmap){release();ReleaseDC(h,screen);return;}previous=SelectObject(back,bitmap);bw=cw;bh=ch;}FillRect(back,&r,static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH)));double scale=std::min(double(cw)/w,double(ch)/height);if(scale>=1)scale=double(int(scale));int dw=std::max(1,int(w*scale)),dh=std::max(1,int(height*scale));BITMAPINFO b{};b.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);b.bmiHeader.biWidth=LONG(w);b.bmiHeader.biHeight=-LONG(height);b.bmiHeader.biPlanes=1;b.bmiHeader.biBitCount=32;b.bmiHeader.biCompression=BI_RGB;SetStretchBltMode(back,settings.filter==1?HALFTONE:COLORONCOLOR);SetBrushOrgEx(back,0,0,nullptr);std::vector<std::uint32_t> copy;const void* source=pixels.data();if(settings.filter==2){copy=filterFrame(pixels,w,height,2);source=copy.data();}StretchDIBits(back,(cw-dw)/2,(ch-dh)/2,dw,dh,0,0,int(w),int(height),source,&b,DIB_RGB_COLORS,SRCCOPY);BitBlt(screen,0,0,cw,ch,back,0,0,SRCCOPY);ReleaseDC(h,screen);}
#endif
};
inline Desktop& desktop(){static Desktop d;return d;}
inline Request takeRequest(){auto r=pending;pending={};return r;}
}
