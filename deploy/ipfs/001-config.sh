#!/bin/sh
# kubo container-init hook: bind API + gateway to 0.0.0.0 so other containers on regenbazaar_net can
# reach them. SECURITY: the RPC API (5001) is reachable ONLY inside the docker network — it is never
# published to the host (see docker-compose.yml: no host port for 5001). Do not expose 5001 publicly.
set -e
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
