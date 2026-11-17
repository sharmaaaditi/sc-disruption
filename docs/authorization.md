# Authorization contract

P1 owns the role policy and its frontend behavior. P2 owns authentication and
must provide a verified user to the API before backend enforcement is wired.

## Identity contract expected from P2

`GET /api/auth/me` returns:

```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "analyst@example.com",
    "name": "Operations analyst",
    "role": "ANALYST"
  }
}
```

The frontend sends credentials with the request. An unauthenticated request
must return `401`, not a placeholder user.

## Roles and permissions

| Capability | VIEWER | ANALYST | ADMIN |
| --- | --- | --- | --- |
| View supply chains | Yes | Yes | Yes |
| View saved simulations | Yes | Yes | Yes |
| Start a simulation | No | Yes | Yes |
| Manage roles | No | No | Yes |

Frontend gates are for clarity only. They are not the security boundary. After
P2 authentication is merged, backend middleware must enforce the same matrix
and return `401` for missing identity and `403` for insufficient permission.

## Development mode

`VITE_DEMO_ROLE` may be set to `VIEWER`, `ANALYST`, or `ADMIN` while running the
Vite development server. It is ignored in production builds and must never be
used as evidence of backend authorization.
