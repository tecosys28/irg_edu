# IRG_FTR Platform v5.0 - API Reference

## Consultant Module

### POST /api/v1/partners/consultants/register
Register a new consultant.

### POST /api/v1/partners/consultants/shortlist
Get shortlisted consultants for a minting application.

### POST /api/v1/partners/consultants/offer
Send offer to a consultant.

### POST /api/v1/partners/consultants/offer/:id/respond
Accept or reject an offer.

### POST /api/v1/partners/consultants/tasks
Allocate a task to a consultant.

### POST /api/v1/partners/consultants/tasks/:id/start
Start working on a task.

### POST /api/v1/partners/consultants/tasks/:id/report
Submit report with HEP verification.

### POST /api/v1/partners/consultants/tasks/:id/fee
Process fee payment.

### GET /api/v1/partners/consultants/tasks
Get consultant tasks.

### GET /api/v1/partners/consultants/dashboard
Get consultant dashboard stats.

## Redemption Module

### POST /api/v1/redemption/initiate
Initiate order-linked redemption.

### POST /api/v1/redemption/verify/:orderId
Verify FTR IDs for redemption.

### POST /api/v1/redemption/confirm
Seller confirmation of sale.

### POST /api/v1/redemption/deregister/:tokenId
Exercise holder deregistration option.

### GET /api/v1/redemption/pending
Get pending redemptions for user.

### GET /api/v1/redemption/surrender-wallets
Get surrender wallets for minter.
