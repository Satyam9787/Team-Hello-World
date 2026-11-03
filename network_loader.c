#include <arpa/inet.h>
#include <bpf/libbpf.h>
#include <signal.h>
#include <stdio.h>
#include <unistd.h>
#include <errno.h>

struct connect_event {
    __u32 pid;
    __u32 tid;
    __u32 uid;
    char comm[16];
    __u16 family;
    __u16 dst_port;
    __u32 dst_addr;
};

static volatile sig_atomic_t running = 1;
static FILE *log_file;

static void handle_signal(int sig)
{
    (void)sig;
    running = 0;
}

static int handle_event(void *ctx, void *data, size_t size)
{
    (void)ctx;

    if (size < sizeof(struct connect_event))
        return 0;

    const struct connect_event *e = data;
    struct in_addr addr = { .s_addr = e->dst_addr };
    char ip[INET_ADDRSTRLEN];

    if (!inet_ntop(AF_INET, &addr, ip, sizeof(ip)))
        return 0;

    fprintf(log_file,
        "{\"event_type\":\"connect_attempt\","
        "\"pid\":%u,\"tid\":%u,\"uid\":%u,"
        "\"comm\":\"%.15s\","
        "\"family\":\"IPv4\","
        "\"destination_ip\":\"%s\","
        "\"destination_port\":%u}\n",
        e->pid, e->tid, e->uid, e->comm,
        ip, e->dst_port);

    fflush(log_file);
    printf("PID=%u COMM=%s DEST=%s:%u\n",
           e->pid, e->comm, ip, e->dst_port);

    return 0;
}

int main(void)
{
    struct bpf_object *obj = NULL;
    struct bpf_program *prog;
    struct bpf_link *link = NULL;
    struct ring_buffer *rb = NULL;
    int err = 1;

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    log_file = fopen("logs/network.events.jsonl", "a");
    if (!log_file) {
        perror("fopen logs/network.events.jsonl");
        return 1;
    }

    libbpf_set_strict_mode(LIBBPF_STRICT_ALL);

    obj = bpf_object__open_file("network_monitor.bpf.o", NULL);
    if (libbpf_get_error(obj)) {
        fprintf(stderr, "Failed to open BPF object\n");
        obj = NULL;
        goto cleanup;
    }

    if (bpf_object__load(obj)) {
        fprintf(stderr, "Failed to load BPF object\n");
        goto cleanup;
    }

    prog = bpf_object__find_program_by_name(obj, "trace_connect");
    if (!prog) {
        fprintf(stderr, "BPF program not found\n");
        goto cleanup;
    }

    link = bpf_program__attach(prog);
    if (libbpf_get_error(link)) {
        fprintf(stderr, "Failed to attach tracepoint\n");
        link = NULL;
        goto cleanup;
    }

    int map_fd = bpf_object__find_map_fd_by_name(obj, "events");
    if (map_fd < 0) {
        fprintf(stderr, "Ring buffer map not found\n");
        goto cleanup;
    }

    rb = ring_buffer__new(map_fd, handle_event, NULL, NULL);
    if (!rb || libbpf_get_error(rb)) {
        fprintf(stderr, "Failed to create ring buffer\n");
        rb = NULL;
        goto cleanup;
    }

    printf("Network monitor running. Press Ctrl+C to stop.\n");

    err = 0;
    while (running) {
        int n = ring_buffer__poll(rb, 250);
        if (n == -EINTR)
            continue;
        if (n < 0) {
            fprintf(stderr, "Ring buffer poll failed: %d\n", n);
            err = 1;
            break;
        }
    }

cleanup:
    ring_buffer__free(rb);
    bpf_link__destroy(link);
    bpf_object__close(obj);
    fclose(log_file);
    return err;
}
