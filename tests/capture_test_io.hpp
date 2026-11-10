#pragma once
#include <filesystem>
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <string>
// Test-only helper. The stream is destroyed before callers validate or delete
// capture artifacts; Windows does not permit deletion through a live CRT handle.
namespace forja65_test {
inline std::string readCaptureFile(const std::filesystem::path& path,bool binary=false){
  std::ifstream input(path,std::ios::in|(binary?std::ios::binary:std::ios::openmode(0)));
  if(!input)throw std::runtime_error("cannot read capture: "+path.string());
  std::string contents((std::istreambuf_iterator<char>(input)),{});
  if(input.bad())throw std::runtime_error("capture read failed: "+path.string());
  return contents;
}
}
