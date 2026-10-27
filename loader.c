#include <stdio.h>
#include <stdint.h>
#include <signal.h>
#include <unistd.h>
#include <time.h>
#include <errno.h>
#include <string.h>

#include <bpf/libbpf.h>

#define LOG_PATH "logs/process.events.jsonl"

static volatile sig_atomic_t stop;

struct process_event {
    uint32_t pid;
    uint32_t ppid;
    char comm[16];
};

struct app_context {
    FILE *log_file;
};

/* Escape strings so they remain valid JSON. */
static void json_escape(
    const char *src, char *dst, size_t dst_size)
{
    size_t j = 0;

    for (size_t i = 0; src[i] != '\0'; i++) {
        unsigned char c = (unsigned char)src[i];

        if (c == '"' || c == '\\') {
            if (j + 2 >= dst_size)
                break;
            dst[j++] = '\\';
            dst[j++] = c;
        } else if (c < 0x20) {
            if (j + 6 >= dst_size)
                break;
            snprintf(dst + j, dst_size - j,
                     "\\u%04x", c);
            j += 6;
        } else {
            if (j + 1 >= dst_size)
                break;
            dst[j++] = c;
        }
    }

    dst[j] = '\0';
}

static int handle_event(
    void *ctx, void *data, size_t data_sz)
{
    struct app_context *app = ctx;
    struct process_event *event = data;
    char comm[17] = {0};
    char escaped_comm[17 * 6 + 1];
    time_t now;

    if (data_sz < sizeof(*event)) {
        fprintf(stderr, "Invalid event size\n");
        return 0;
    }

    memcpy(comm, event->comm, sizeof(event->comm));
    comm[16] = '\0';

    json_escape(comm, escaped_comm, sizeof(escaped_comm));
    now = time(NULL);

    /* Save first, before printing to the terminal. */
    if (fprintf(app->log_file,
        "{\"event\":\"PROCESS_EXEC_ATTEMPT\","
        "\"pid\":%u,\"ppid\":%u,"
        "\"comm\":\"%s\",\"timestamp_unix\":%lld}\n",
        event->pid,
        event->ppid,
        escaped_comm,
        (long long)now) < 0 || fflush(app->log_file) != 0) {
        fprintf(stderr, "Failed to write process log\n");
        return 0;
    }

    printf("Process execution detected!\n");
    printf("PID: %u | PPID: %u | COMM: %s\n\n",
           event->pid, event->ppid, comm);
    fflush(stdout);

    return 0;
}

static void handle_signal(int sig)
{
    (void)sig;
    stop = 1;
}

int main(void)
{
    struct bpf_object *obj = NULL;
    struct bpf_program *prog;
    struct bpf_link *link = NULL;
    struct bpf_map *map;
    struct ring_buffer *rb = NULL;
    struct app_context app = {0};
    int err = 1;

    libbpf_set_print(NULL);

    app.log_file = fopen(LOG_PATH, "a");
    if (!app.log_file) {
        perror("Failed to open process log");
        return 1;
    }

    obj = bpf_object__open_file("monitor.bpf.o", NULL);
    err = libbpf_get_error(obj);
    if (err) {
        fprintf(stderr, "Failed to open BPF object: %d\n", err);
        obj = NULL;
        goto cleanup;
    }

    err = bpf_object__load(obj);
    if (err) {
        fprintf(stderr, "Failed to load BPF object: %d\n", err);
        goto cleanup;
    }

    prog = bpf_object__find_program_by_name(obj, "handle_execve");
    if (!prog) {
        fprintf(stderr, "BPF program not found\n");
        err = -1;
        goto cleanup;
    }

    map = bpf_object__find_map_by_name(obj, "events");
    if (!map) {
        fprintf(stderr, "Ring buffer map 'events' not found\n");
        err = -1;
        goto cleanup;
    }

    rb = ring_buffer__new(
        bpf_map__fd(map), handle_event, &app, NULL);

    err = libbpf_get_error(rb);
    if (err) {
        fprintf(stderr, "Failed to create ring buffer: %d\n", err);
        rb = NULL;
        goto cleanup;
    }

    link = bpf_program__attach_tracepoint(
        prog, "syscalls", "sys_enter_execve");

    err = libbpf_get_error(link);
    if (err) {
        fprintf(stderr, "Tracepoint attach failed: %d\n", err);
        link = NULL;
        goto cleanup;
    }

    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    printf("Process monitor running.\n");
    printf("Logging to %s\nPress Ctrl+C to stop.\n\n", LOG_PATH);

    err = 0;
    while (!stop) {
        int ret = ring_buffer__poll(rb, 250);

        if (ret == -EINTR)
            continue;

        if (ret < 0) {
            fprintf(stderr, "Ring buffer poll failed: %d\n", ret);
            err = ret;
            break;
        }
    }

cleanup:
    if (link)
        bpf_link__destroy(link);
    if (rb)
        ring_buffer__free(rb);
    if (obj)
        bpf_object__close(obj);
    if (app.log_file)
        fclose(app.log_file);

    return err ? 1 : 0;
}

