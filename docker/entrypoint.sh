#!/bin/sh
# Container entrypoint. Written to work with the binary both before and after
# it learns --host and zero-config startup:
#  - passes --host 0.0.0.0 only if the binary advertises --host (the container
#    must listen on all interfaces to be reachable through a published port);
#  - with no arguments, falls back to the baked config that serves /workspace.
set -eu

bin=/app/openspec-ui

if [ "$#" -eq 0 ]; then
  set -- --config /app/openspec-ui.json
fi

case " $* " in
  *" --host "* | *" --host="*) ;;
  *)
    if "$bin" --help 2>&1 | grep -q -- '--host'; then
      set -- "$@" --host 0.0.0.0
    fi
    ;;
esac

# Never try to open a browser inside a container, if the binary can.
case " $* " in
  *" --no-open "*) ;;
  *)
    if "$bin" --help 2>&1 | grep -q -- '--no-open'; then
      set -- "$@" --no-open
    fi
    ;;
esac

exec "$bin" "$@"
