import { LightningElement, api, track } from 'lwc';
import getAvailableProducts from '@salesforce/apex/OrderChatController.getAvailableProducts';
import addToCart from '@salesforce/apex/OrderChatController.addToCart';
import getCart from '@salesforce/apex/OrderChatController.getCart';
import checkout from '@salesforce/apex/OrderChatController.checkout';
import removeItem from '@salesforce/apex/OrderChatController.removeItem';
import botAvatar from '@salesforce/resourceUrl/botAvatar';
import userAvatar from '@salesforce/resourceUrl/userAvatar';
import chatbotLogo from '@salesforce/resourceUrl/chatbotLogo';

export default class ChatBotContainer extends LightningElement {
    @api recordId;
    @track messages = [];
    @track inputText = '';
    @track cart = null;

    @track isOpen = false;
    @track isFullscreen = false;
    @track isBotTyping = false;
    @track showQuickReplies = false;
    @track quickReplies = [];

    botAvatar = botAvatar;
    userAvatar = userAvatar;
    chatbotLogo = chatbotLogo;

    connectedCallback() {
        this.addBotMessage('👋 Hello! Type "show products", "add [product]", "show cart", "remove", or "checkout".', [
            { id: 1, text: 'show products' },
            { id: 2, text: 'show cart' },
            { id: 3, text: 'checkout' },
            { id: 4, text: 'Need Help' }
        ]);
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.isFullscreen = false;
    }

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
    }

    get fullscreenIcon() {
        return this.isFullscreen ? 'utility:contract_alt' : 'utility:expand_alt';
    }

    get chatContainerClass() {
        let classes = 'chat-container';
        if (this.isOpen) classes += ' open';
        if (this.isFullscreen) classes += ' fullscreen';
        return classes;
    }

    addUserMessage(text) {
        this.messages = [...this.messages, {
            id: Date.now(),
            text: text,
            containerClass: 'message-container user',
            bubbleClass: 'message-bubble user',
            avatar: this.userAvatar,
            senderAlt: 'You',
            timestamp: this.getCurrentTime()
        }];
        this.scrollToBottom();
    }

    addBotMessage(text, quickReplies = [], isHtml = false) {
        this.messages = [...this.messages, {
            id: Date.now(),
            text: text,
            isHtml: isHtml,
            containerClass: 'message-container bot',
            bubbleClass: 'message-bubble bot',
            avatar: this.botAvatar,
            senderAlt: 'Assistant',
            timestamp: this.getCurrentTime()
        }];

        this.quickReplies = quickReplies;
        this.showQuickReplies = quickReplies.length > 0;
        this.scrollToBottom();
    }

    handleInput(event) {
        this.inputText = event.detail.value;
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleSend();
        }
    }

    handleSend() {
        const msg = this.inputText.trim();
        if (!msg) return;

        this.addUserMessage(msg);
        this.processInput(msg.toLowerCase());
        this.inputText = '';
    }

    async processInput(input) {
        if (input === 'show products') {
            this.isBotTyping = true;
            const products = await getAvailableProducts();
            let tableHtml = `
                <table style="width:100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 6px; border-bottom: 1px solid #ccc;">Product</th>
                            <th style="text-align: left; padding: 6px; border-bottom: 1px solid #ccc;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            products.forEach(p => {
                tableHtml += `
                    <tr>
                        <td style="padding: 6px; border-bottom: 1px solid #eee;">${p.Name}</td>
                        <td style="padding: 6px; border-bottom: 1px solid #eee;">₹${p.Unit_Price__c}</td>
                    </tr>
                `;
            });
            tableHtml += `</tbody></table>`;
            this.isBotTyping = false;
            this.addBotMessage(tableHtml, [], true);
        } 
        else if (input.startsWith('add ')) {
            this.isBotTyping = true;
            const name = input.replace('add ', '').trim().toLowerCase();
            const products = await getAvailableProducts();
            const match = products.find(p => p.Name.toLowerCase() === name);

            if (match) {
                await addToCart({ contactId: this.recordId, productId: match.Id });
                this.isBotTyping = false;
                this.addBotMessage(`✅ ${match.Name} added to cart.`);
                this.loadCart();
            } else {
                this.isBotTyping = false;
                this.addBotMessage(`❌ Product not found.`);
            }
        } 
        else if (input === 'show cart') {
            this.isBotTyping = true;
            await this.loadCart();
            this.isBotTyping = false;
            this.addBotMessage('🛒 Cart details shown.');
        } 
        else if (input === 'remove') {
            this.isBotTyping = true;
            const res = await removeItem({ contactId: this.recordId });
            this.isBotTyping = false;
            this.addBotMessage(res);
            this.cart = null;
        } 
        else if (input === 'checkout') {
            this.isBotTyping = true;
            const res = await checkout({ contactId: this.recordId });
            this.isBotTyping = false;
            this.cart = null;
            this.addBotMessage(res);
        } 
        else {
            this.isBotTyping = true;
            setTimeout(() => {
                this.isBotTyping = false;
                this.addBotMessage("🤖 Sorry, I didn't understand that.");
            }, 1000);
        }
    }

    async loadCart() {
        const cartData = await getCart({ contactId: this.recordId });
        if (cartData && cartData.items && cartData.items.length > 0) {
            this.cart = cartData;

            let tableHtml = `
                <table style="width:100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 6px; border-bottom: 1px solid #ccc;">Item</th>
                            <th style="text-align: left; padding: 6px; border-bottom: 1px solid #ccc;">Qty</th>
                            <th style="text-align: left; padding: 6px; border-bottom: 1px solid #ccc;">Unit Price</th>
                            <th style="text-align: left; padding: 6px; border-bottom: 1px solid #ccc;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            cartData.items.forEach(item => {
                tableHtml += `
                    <tr>
                        <td style="padding: 6px;">${item.productName}</td>
                        <td style="padding: 6px;">${item.quantity}</td>
                        <td style="padding: 6px;">₹${item.unitPrice}</td>
                        <td style="padding: 6px;">₹${item.totalPrice}</td>
                    </tr>
                `;
            });
            tableHtml += `
                <tr style="font-weight: bold; border-top: 1px solid #000;">
                    <td colspan="3" style="padding: 6px;">Total</td>
                    <td style="padding: 6px;">₹${cartData.grandTotal}</td>
                </tr>
                </tbody>
                </table>
            `;
            this.addBotMessage(tableHtml, [], true);
        } else {
            this.cart = null;
            this.addBotMessage('🛒 Your cart is empty.');
        }
    }

    handleQuickReply(event) {
        const replyText = event.target.label;
        this.inputText = replyText;
        this.handleSend();
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.template.querySelector('.chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }, 0);
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    renderedCallback() {
        const htmlMessages = this.template.querySelectorAll('.html-message');
        htmlMessages.forEach(div => {
            const msgId = Number(div.dataset.id);
            const msg = this.messages.find(m => m.id === msgId);
            if (msg && msg.isHtml) {
                div.innerHTML = msg.text;
            }
        });
    }
}
