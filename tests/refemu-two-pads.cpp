#define main forja_reference_cli_main
#include "../tools/libretro-reference/refemu.cpp"
#undef main
#include <stdexcept>
static void require(bool v){if(!v)throw std::runtime_error("reference two-pad isolation failed");}
int main(){
 joy=0x8000;joy2=0x0080;
 require(state(0,RETRO_DEVICE_JOYPAD,0,0)==1);
 require(state(0,RETRO_DEVICE_JOYPAD,0,8)==0);
 require(state(1,RETRO_DEVICE_JOYPAD,0,8)==1);
 require(state(1,RETRO_DEVICE_JOYPAD,0,0)==0);
 require(state(2,RETRO_DEVICE_JOYPAD,0,0)==0);
 require(state(1,RETRO_DEVICE_JOYPAD,0,12)==0);
 std::cout<<"REFERENCE_TWO_PAD_ISOLATION_PASS\n";
}
