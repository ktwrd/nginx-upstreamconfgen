# NGINX Upstream Config Generator
Small script that is used for generating a nginx config file which contains multiple upstreams. The IP address for the upstream connections are fetched with `docker inspect` and are defined in `config.json` ([see example](#example-config)).

Used primariarly by the [Xenia Bot Project](https://xenia.kate.pet).

## Requirements
- Node.js v20 or later
- NGINX w/ `ngx_http_upstream_module`
- Docker
- No external packages are used

## Example config
If you wish to see more information about the config schema, look at the typedef for `ConfigData` in `index.js`.
```json
{
    "outputLocation": "/etc/nginx/conf.d/1_upstream.conf",
    "items": [
        {
            "containerName": "jellyfin",
            "upstreamName": "jellyfin_prod",
            "port": 8096,
            "extra": "fail_timeout=0"
        },
        {
            "containerName": "guacamole_compose",
            "upstreamName": "guac_prod",
            "port": 8700
        }
    ]
}
```
