#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdio.h>
// Test-only reproduction of Windows: a file with a live CRT stream cannot be removed.
static int open_file(const struct stat *target){
 if(!S_ISREG(target->st_mode))return 0;
 for(int fd=0;fd<1024;fd++){struct stat s;if(!fstat(fd,&s)&&s.st_dev==target->st_dev&&s.st_ino==target->st_ino){fprintf(stderr,"WINDOWS_DELETE_GUARD: file still open (fd=%d)\n",fd);errno=EACCES;return 1;}}
 return 0;
}
int unlink(const char *path){struct stat s;if(!stat(path,&s)&&open_file(&s))return -1;int(*real)(const char*)=dlsym(RTLD_NEXT,"unlink");return real(path);}
int unlinkat(int dirfd,const char *path,int flags){struct stat s;if(!fstatat(dirfd,path,&s,0)&&open_file(&s))return -1;int(*real)(int,const char*,int)=dlsym(RTLD_NEXT,"unlinkat");return real(dirfd,path,flags);}
int remove(const char *path){struct stat s;if(!stat(path,&s)&&open_file(&s))return -1;int(*real)(const char*)=dlsym(RTLD_NEXT,"remove");return real(path);}
