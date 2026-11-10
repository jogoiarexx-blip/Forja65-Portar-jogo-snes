#ifndef FORJA_IR_HPP
#define FORJA_IR_HPP
#include <array>
#include <cstdint>
#include <stdexcept>
#include <vector>
#include <utility>
// Host representation: no PPU registers, SNES DMA engine or ROM bus.
struct ForjaRenderer {
  std::array<std::uint16_t,256> palette{};
  struct Scroll {int x{},y{};};std::array<Scroll,4> layers{};
  std::uint64_t paletteUploads{},scrollUpdates{};
  void uploadPalette(unsigned first,const std::vector<std::uint16_t>&colors){if(first>256||colors.size()>256-first)throw std::out_of_range("Palette range");for(auto c:colors)if(c>0x7fff)throw std::out_of_range("Palette color");for(std::size_t i=0;i<colors.size();i++)palette[first+i]=colors[i];paletteUploads++;}
  void setLayerScroll(unsigned layer,int x,int y){if(layer>=layers.size())throw std::out_of_range("Layer");layers[layer]={x,y};scrollUpdates++;}
};
struct ForjaIR {
  enum class Op {SetPalette,SetScroll};
  Op op{};unsigned index{};int x{},y{};std::vector<std::uint16_t> colors;
  static ForjaIR setPalette(unsigned first,std::vector<std::uint16_t> colors){return {Op::SetPalette,first,0,0,std::move(colors)};}
  static ForjaIR setScroll(unsigned layer,int x,int y){return {Op::SetScroll,layer,x,y,{}};}
  void apply(ForjaRenderer&host)const{if(op==Op::SetPalette)host.uploadPalette(index,colors);else if(op==Op::SetScroll)host.setLayerScroll(index,x,y);else throw std::invalid_argument("Unknown ForjaIR op");}
};

#endif
