#ifndef CLASSIFY_H
#define CLASSIFY_H

#include <stdbool.h>

/* ---------- RESULT TYPE ---------- */

typedef enum {
    VERDICT_SAFE,
    VERDICT_UNSAFE,
    VERDICT_PARTIAL,
    VERDICT_UNKNOWN
} verdict_t;

typedef struct {
    verdict_t verdict;
    char reason[256];
} classification_t;

/* ---------- INPUT: what you already have from the kernel payload ---------- */

typedef struct {
    const char *comm;          /* process name */
    const char *cmd;           /* full command line / path, if available */
    int pid;
    int ppid;
    const char *parent_comm;   /* optional: comm of ppid, NULL if unknown */
} process_event_t;

typedef struct {
    const char *comm;
    const char *destination_ip;
    int destination_port;
} network_event_t;

/* ---------- VERDICT -> STRING (for the JSON "status" field) ---------- */

static inline const char *verdict_to_str(verdict_t v) {
    switch (v) {
        case VERDICT_SAFE:    return "safe";
        case VERDICT_UNSAFE:  return "unsafe";
        case VERDICT_PARTIAL: return "partial";
        default:              return "unknown";
    }
}

/* ---------- CONFIG: fill these from your own policy / threat intel ---------- */

static const char *PROCESS_DENYLIST[] = {
    "mimikatz", "ncat", "nc", "xmrig", "john", "hashcat", NULL
};

static const char *PROCESS_ALLOWLIST[] = {
    "chrome", "electron", "code", "python3", "bash", "sshd",
    "systemd", "node", "firefox", "brave", "kgx", NULL
};

static const char *SUSPICIOUS_PATHS[] = {
    "/tmp/", "/dev/shm/", "/var/tmp/", NULL
};

static const char *MALICIOUS_PORTS_LIST[] = { "4444", "1337", "6667", NULL };

/* Add known-bad IPs here, or load them at startup from a threat-intel feed
   into a hash set instead of a flat array if the list grows large. */
static const char *MALICIOUS_IPS[] = { NULL };

/* Your own approved network ranges, matched as a string prefix. */
static const char *ALLOWED_IP_PREFIXES[] = { NULL };

/* ---------- HELPERS ---------- */

static inline bool str_contains(const char *haystack, const char *needle) {
    if (!haystack || !needle) return false;
    return strstr(haystack, needle) != NULL;
}

static inline bool list_contains_substr(const char *value, const char **list) {
    if (!value) return false;
    for (int i = 0; list[i] != NULL; i++) {
        if (str_contains(value, list[i])) return true;
    }
    return false;
}

static inline bool list_has_prefix(const char *value, const char **list) {
    if (!value) return false;
    for (int i = 0; list[i] != NULL; i++) {
        if (strncmp(value, list[i], strlen(list[i])) == 0) return true;
    }
    return false;
}

/* ---------- PROCESS CLASSIFIER ---------- */

static inline classification_t classify_process(const process_event_t *ev) {
    classification_t result;

    /* 1. Denylist */
    if (list_contains_substr(ev->comm, PROCESS_DENYLIST)) {
        result.verdict = VERDICT_UNSAFE;
        snprintf(result.reason, sizeof(result.reason),
                 "Matched known malicious binary pattern: \"%s\".",
                 ev->comm ? ev->comm : "unknown");
        return result;
    }

    /* 2. Suspicious execution path */
    if (list_contains_substr(ev->cmd, SUSPICIOUS_PATHS)) {
        result.verdict = VERDICT_UNSAFE;
        snprintf(result.reason, sizeof(result.reason),
                 "Executed from a suspicious path (%s).",
                 ev->cmd ? ev->cmd : "unknown");
        return result;
    }

    /* 3. Suspicious parent -> child pairing (fill in your own policy) */
    if (ev->parent_comm) {
        bool office_to_shell =
            (str_contains(ev->parent_comm, "winword") ||
             str_contains(ev->parent_comm, "excel")) &&
            (str_contains(ev->comm, "powershell") ||
             str_contains(ev->comm, "cmd") ||
             str_contains(ev->comm, "bash"));

        if (office_to_shell) {
            result.verdict = VERDICT_PARTIAL;
            snprintf(result.reason, sizeof(result.reason),
                     "\"%s\" was spawned by \"%s\", an uncommon parent-child pairing.",
                     ev->comm, ev->parent_comm);
            return result;
        }
    }

    /* 4. Allowlist */
    if (list_contains_substr(ev->comm, PROCESS_ALLOWLIST)) {
        result.verdict = VERDICT_SAFE;
        snprintf(result.reason, sizeof(result.reason),
                 "\"%s\" is on the approved binary list.",
                 ev->comm ? ev->comm : "unknown");
        return result;
    }

    /* 5. Unrecognized binary, no reputation data either way */
    if (ev->comm && ev->comm[0] != '\0') {
        result.verdict = VERDICT_PARTIAL;
        snprintf(result.reason, sizeof(result.reason),
                 "\"%s\" is not on the allow or deny list and has no reputation data yet.",
                 ev->comm);
        return result;
    }

    /* 6. Nothing matched */
    result.verdict = VERDICT_UNKNOWN;
    snprintf(result.reason, sizeof(result.reason),
             "Insufficient information to classify this process event.");
    return result;
}

/* ---------- NETWORK CLASSIFIER ---------- */

static inline classification_t classify_network(const network_event_t *ev) {
    classification_t result;
    char port_str[16];
    snprintf(port_str, sizeof(port_str), "%d", ev->destination_port);

    /* 1. Known-bad destination IP */
    if (list_contains_substr(ev->destination_ip, MALICIOUS_IPS)) {
        result.verdict = VERDICT_UNSAFE;
        snprintf(result.reason, sizeof(result.reason),
                 "Destination IP %s matches a known threat-intel indicator.",
                 ev->destination_ip ? ev->destination_ip : "unknown");
        return result;
    }

    /* 2. Known-bad port */
    for (int i = 0; MALICIOUS_PORTS_LIST[i] != NULL; i++) {
        if (strcmp(port_str, MALICIOUS_PORTS_LIST[i]) == 0) {
            result.verdict = VERDICT_UNSAFE;
            snprintf(result.reason, sizeof(result.reason),
                     "Destination port %d is commonly associated with malicious C2 traffic.",
                     ev->destination_port);
            return result;
        }
    }

    /* 3. Approved destination range */
    if (list_has_prefix(ev->destination_ip, ALLOWED_IP_PREFIXES)) {
        result.verdict = VERDICT_SAFE;
        snprintf(result.reason, sizeof(result.reason),
                 "Destination %s is within an approved network range.",
                 ev->destination_ip ? ev->destination_ip : "unknown");
        return result;
    }

    /* 4. Uncommon process making an outbound connection on a high port */
    bool looks_normal =
        str_contains(ev->comm, "chrome") || str_contains(ev->comm, "firefox") ||
        str_contains(ev->comm, "electron") || str_contains(ev->comm, "sshd") ||
        str_contains(ev->comm, "systemd") || str_contains(ev->comm, "curl") ||
        str_contains(ev->comm, "wget");

    if (!looks_normal && ev->destination_port > 1024) {
        result.verdict = VERDICT_PARTIAL;
        snprintf(result.reason, sizeof(result.reason),
                 "\"%s\" (an uncommon process for outbound traffic) connected to %s:%d.",
                 ev->comm ? ev->comm : "unknown",
                 ev->destination_ip ? ev->destination_ip : "unknown",
                 ev->destination_port);
        return result;
    }

    /* 5. Nothing matched */
    result.verdict = VERDICT_UNKNOWN;
    snprintf(result.reason, sizeof(result.reason),
             "Insufficient information to classify this network event.");
    return result;
}

#endif /* CLASSIFY_H */