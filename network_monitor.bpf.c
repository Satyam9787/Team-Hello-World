#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include <bpf/bpf_endian.h>

#define AF_INET_VALUE 2
#define IPPROTO_TCP_VALUE 6

struct sockaddr_in_local {
    __u16 sin_family;
    __u16 sin_port;
    __u32 sin_addr;
};

struct connect_event {
    __u32 pid;
    __u32 tid;
    __u32 uid;
    char comm[16];

    __u16 family;
    __u16 dst_port;  // Host byte order
    __u32 dst_addr;  // IPv4 address, network byte order
};

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 1 << 20);
} events SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_connect")
int trace_connect(struct trace_event_raw_sys_enter *ctx)
{
    __u64 pid_tgid = bpf_get_current_pid_tgid();

    // connect(fd, user_sockaddr, addrlen)
    const void *user_addr = (const void *)ctx->args[1];

    struct sockaddr_in_local sa = {};

    if (!user_addr)
        return 0;

    if (bpf_probe_read_user(&sa, sizeof(sa), user_addr))
        return 0;

    if (sa.sin_family != AF_INET_VALUE)
        return 0;

    struct connect_event *e;

    e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e)
        return 0;

    e->pid = pid_tgid >> 32;
    e->tid = (__u32)pid_tgid;
    e->uid = (__u32)bpf_get_current_uid_gid();
    e->family = sa.sin_family;
    e->dst_port = bpf_ntohs(sa.sin_port);
    e->dst_addr = sa.sin_addr;

    bpf_get_current_comm(&e->comm, sizeof(e->comm));

    bpf_ringbuf_submit(e, 0);
    return 0;
}

char LICENSE[] SEC("license") = "GPL";
