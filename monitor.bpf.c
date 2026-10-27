#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_core_read.h>

char LICENSE[] SEC("license") = "GPL";

struct process_event {
    __u32 pid;
    __u32 ppid;
    char comm[16];
};

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 1 << 24);
} events SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_execve")
int handle_execve(void *ctx)
{
   struct process_event *event;
   __u64 pid_tgid;
   __u64 task_ptr;
   struct task_struct *task;

   pid_tgid = bpf_get_current_pid_tgid();

   event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
   if(!event)
      return 0;

   event->pid = pid_tgid >> 32;
   event->ppid = 0;
   bpf_get_current_comm(event->comm, sizeof(event->comm));

   task_ptr = bpf_get_current_task();
   task = (struct task_struct *)task_ptr;

   BPF_CORE_READ_INTO(&event->ppid, task, real_parent, tgid);
  
   bpf_ringbuf_submit(event, 0);

   bpf_printk("Process execution detected!");
   return 0;
}

