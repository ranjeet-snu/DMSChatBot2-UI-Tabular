public with sharing class OrderChatController {

    // Get all available products
    @AuraEnabled(cacheable=true)
    public static List<DMS_Product__c> getAvailableProducts() {
        return [SELECT Id, Name, Unit_Price__c FROM DMS_Product__c];
    }

    // Add item to cart
    @AuraEnabled
    public static String addToCart(String contactId, String productId) {
        Contact c = [SELECT Id, AccountId FROM Contact WHERE Id = :contactId LIMIT 1];
        DMS_Order__c order = getOrCreateDraftOrder(c.Id, c.AccountId);

        // Check if this product already exists in the order
        List<Order_Line_Item__c> lineItems = [
            SELECT Id, Quantity__c 
            FROM Order_Line_Item__c 
            WHERE Order__c = :order.Id AND Product__c = :productId
        ];

        if (!lineItems.isEmpty()) {
            // Increment quantity
            Order_Line_Item__c line = lineItems[0];
            line.Quantity__c += 1;
            update line;
        } else {
            // Create new line item
            Order_Line_Item__c newLine = new Order_Line_Item__c(
                Order__c = order.Id,
                Product__c = productId,
                Quantity__c = 1
            );
            insert newLine;
        }

        return 'Product added to cart';
    }

    // Ensure a draft order exists for this contact
    private static DMS_Order__c getOrCreateDraftOrder(Id contactId, Id accountId) {
        List<DMS_Order__c> existing = [
            SELECT Id
            FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft'
            LIMIT 1
        ];

        if (!existing.isEmpty()) {
            return existing[0];
        }

        DMS_Order__c order = new DMS_Order__c(
            Contact__c = contactId,
            Account__c = accountId,
            Status__c = 'Draft'
        );
        insert order;
        return order;
    }

    // Return cart details with full list of items
    @AuraEnabled
    public static Map<String, Object> getCart(String contactId) {
        Map<String, Object> cart = new Map<String, Object>();
        Decimal grandTotal = 0;
        List<Map<String, Object>> items = new List<Map<String, Object>>();

        List<DMS_Order__c> orders = [
            SELECT Id
            FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft'
            LIMIT 1
        ];

        if (orders.isEmpty()) {
            return cart;
        }

        Id orderId = orders[0].Id;

        List<Order_Line_Item__c> lines = [
            SELECT Quantity__c, Product__r.Name, Product__r.Unit_Price__c
            FROM Order_Line_Item__c
            WHERE Order__c = :orderId
        ];

        for (Order_Line_Item__c line : lines) {
            Decimal qty = line.Quantity__c != null ? line.Quantity__c : 1;
            Decimal price = line.Product__r.Unit_Price__c != null ? line.Product__r.Unit_Price__c : 0;
            Decimal itemTotal = qty * price;

            Map<String, Object> item = new Map<String, Object>{
                'productName' => line.Product__r.Name,
                'quantity' => qty,
                'unitPrice' => price,
                'totalPrice' => itemTotal
            };

            items.add(item);
            grandTotal += itemTotal;
        }

        if (!items.isEmpty()) {
            cart.put('items', items);
            cart.put('grandTotal', grandTotal);
        }

        return cart;
    }

    @AuraEnabled
    public static String checkout(String contactId) {
        List<DMS_Order__c> orders = [
            SELECT Id FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft' LIMIT 1
        ];

        if (!orders.isEmpty()) {
            DMS_Order__c order = orders[0];
            order.Status__c = 'Submitted';
            update order;
            return 'Order submitted successfully. Order ID: ' + order.Id;
        }

        return 'No items in cart.';
    }

    @AuraEnabled
    public static String removeItem(String contactId) {
        List<DMS_Order__c> orders = [
            SELECT Id FROM DMS_Order__c
            WHERE Contact__c = :contactId AND Status__c = 'Draft' LIMIT 1
        ];

        if (!orders.isEmpty()) {
            delete orders[0];
            return 'Item removed from cart.';
        }

        return 'No item to remove.';
    }
}
