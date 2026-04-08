import { Component, OnInit, inject, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-direct-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './direct-messages.html',
  styleUrl: './direct-messages.css'
})
export class DirectMessagesComponent implements OnInit {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  currentUser = this.authService.currentUser;
  conversations = signal<any[]>([]);
  activeChat = signal<any | null>(null);
  messages = signal<any[]>([]);
  newMessage = signal<string>('');
  selectedImage = signal<string | null>(null);
  loading = signal<boolean>(false);

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (user) {
        this.loadConversations();
      }
    });
  }

  ngOnInit() {
    // Check query params for starting a specific chat
    this.route.queryParams.subscribe(params => {
      const targetId = params['userId'];
      if (targetId) {
        this.startChatWith(Number(targetId));
      }
    });
  }

  startChatWith(userId: number) {
    // Wait for conversations to load first if needed
    const checkAndSelect = () => {
      const existing = this.conversations().find(c => c.id === userId);
      if (existing) {
        this.selectChat(existing);
      } else {
        // Fetch user info to create a "temporary" conversation item
        this.authService.getUserById(userId).subscribe({
          next: (user) => {
            const tempConv = {
              id: user.id,
              username: user.username,
              profile_image: user.profile_image,
              last_message: 'Inicia una conversación...',
              is_read: true
            };
            this.conversations.update(all => [tempConv, ...all]);
            this.selectChat(tempConv);
          }
        });
      }
    };

    if (this.conversations().length > 0) {
      checkAndSelect();
    } else {
      // Small timeout to allow initial load or wait for loadConversations
      setTimeout(checkAndSelect, 500);
    }
  }

  loadConversations() {
    const user = this.currentUser();
    if (!user) return;

    this.chatService.getConversations(user.id).subscribe({
      next: (data) => this.conversations.set(data),
      error: (err) => console.error('Error cargando conversaciones:', err)
    });
  }

  selectChat(otherUser: any) {
    this.activeChat.set(otherUser);
    this.loadMessages();
    this.markChatAsRead(otherUser.id);
  }

  loadMessages() {
    const user = this.currentUser();
    const other = this.activeChat();
    if (!user || !other) return;

    this.chatService.getChatHistory(user.id, other.id).subscribe({
      next: (data) => {
        this.messages.set(data);
        this.scrollToBottom();
      },
      error: (err) => console.error('Error cargando mensajes:', err)
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedImage.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  sendMessage() {
    const content = this.newMessage().trim();
    const imageUrl = this.selectedImage();
    const user = this.currentUser();
    const other = this.activeChat();

    if ((!content && !imageUrl) || !user || !other) return;

    this.chatService.sendMessage(user.id, other.id, content, imageUrl || undefined).subscribe({
      next: (msg) => {
        this.messages.update(msgs => [...msgs, msg]);
        this.newMessage.set('');
        this.selectedImage.set(null);
        this.loadConversations(); // Update last message in list
        this.scrollToBottom();
      },
      error: (err) => console.error('Error enviando mensaje:', err)
    });
  }

  markChatAsRead(otherId: number) {
    const user = this.currentUser();
    if (!user) return;

    this.chatService.markAsRead(user.id, otherId).subscribe({
      next: () => this.loadConversations(), // Refresh unread badges
      error: (err) => console.error('Error marcando como leído:', err)
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      } catch(err) { }
    }, 100);
  }
}
