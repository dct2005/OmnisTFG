import { Component, OnInit, inject, signal, effect, ElementRef, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-direct-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  groups = signal<any[]>([]);
  allFriends = signal<any[]>([]);
  isGroup = signal<boolean>(false);
  
  friends = computed(() => {
    const convIds = new Set(this.conversations().map(c => c.id));
    return this.allFriends().filter(f => !convIds.has(f.id));
  });

  activeChat = signal<any | null>(null);
  messages = signal<any[]>([]);
  newMessage = signal<string>('');
  selectedImage = signal<string | null>(null);
  loading = signal<boolean>(false);
  isOtherTyping = signal<boolean>(false);
  private pollingInterval: any;
  private typingInterval: any;
  private typingTimeout: any;

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (user) {
        this.loadConversations();
        this.loadGroups();
        this.loadFriends();
      }
    });
  }

  ngOnInit() {
    // Check query params for starting a specific chat
    this.route.queryParams.subscribe(params => {
      const targetId = params['userId'];
      const groupId = params['groupId'];
      if (targetId) {
        this.startChatWith(Number(targetId));
      } else if (groupId) {
        this.loadGroups(Number(groupId));
      } else if (params['action'] === 'create-group') {
        this.openCreateGroupModal();
      }
    });

    // Start global polling for new conversations/unread dots
    this.startGlobalPolling();
  }

  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.typingInterval) clearInterval(this.typingInterval);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    
    // Ensure we stop typing status if we leave
    const user = this.currentUser();
    const other = this.activeChat();
    if (user && other) {
      this.chatService.setTypingStatus(user.id, other.id, false).subscribe();
    }
  }

  startGlobalPolling() {
    this.pollingInterval = setInterval(() => {
      this.loadConversations();
      this.loadGroups();
      if (this.activeChat()) {
        this.loadMessages(false); // Silent load
        if (!this.isGroup()) this.checkTypingStatus();
      }
    }, 3000);
  }

  checkTypingStatus() {
    const user = this.currentUser();
    const other = this.activeChat();
    if (!user || !other) return;

    this.chatService.getTypingStatus(user.id, other.id).subscribe({
      next: (res) => this.isOtherTyping.set(res.isTyping)
    });
  }

  onTyping(event: any) {
    const user = this.currentUser();
    const other = this.activeChat();
    if (!user || !other) return;

    // Send typing status
    this.chatService.setTypingStatus(user.id, other.id, true).subscribe();

    // Reset timeout to stop typing status after 3s of inactivity
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.setTypingStatus(user.id, other.id, false).subscribe();
    }, 3000);
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

  loadGroups(autoSelectId?: number) {
    const user = this.currentUser();
    if (!user) return;

    this.chatService.getGroups(user.id).subscribe({
      next: (data) => {
        this.groups.set(data);
        if (autoSelectId) {
          const group = data.find(g => g.id === autoSelectId);
          if (group) this.selectGroup(group);
        }
      },
      error: (err) => console.error('Error cargando grupos:', err)
    });
  }

  loadFriends() {
    const user = this.currentUser();
    if (!user) return;

    this.authService.getFriends(user.id).subscribe({
      next: (data) => this.allFriends.set(data),
      error: (err) => console.error('Error cargando amigos:', err)
    });
  }

  selectChat(otherUser: any) {
    this.isGroup.set(false);
    this.activeChat.set(otherUser);
    this.loadMessages();
    this.markChatAsRead(otherUser.id);
  }

  selectGroup(group: any) {
    this.isGroup.set(true);
    this.activeChat.set(group);
    this.loadMessages();
    // Logic for marking group as read could be added later
  }

  loadMessages(showLoading: boolean = true) {
    const user = this.currentUser();
    const other = this.activeChat();
    if (!user || !other) return;

    if (showLoading && this.messages().length === 0) this.loading.set(true);

    const obs = this.isGroup() 
      ? this.chatService.getGroupChat(other.id)
      : this.chatService.getChatHistory(user.id, other.id);

    obs.subscribe({
      next: (data) => {
        // Only update and scroll if new messages arrived
        if (data.length !== this.messages().length) {
          this.messages.set(data);
          this.scrollToBottom();
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando mensajes:', err);
        this.loading.set(false);
      }
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

    const obs = this.isGroup()
      ? this.chatService.sendGroupMessage(other.id, user.id, content, imageUrl || undefined)
      : this.chatService.sendMessage(user.id, other.id, content, imageUrl || undefined);

    obs.subscribe({
      next: (msg) => {
        this.messages.update(msgs => [...msgs, msg]);
        this.newMessage.set('');
        this.selectedImage.set(null);
        if (!this.isGroup()) {
          this.loadConversations(); 
        } else {
          this.loadGroups();
        }
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

  async openCreateGroupModal() {
    const friendList = this.allFriends();
    let optionsHtml = '';
    friendList.forEach(f => {
      optionsHtml += `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <input type="checkbox" class="swal2-checkbox-group" value="${f.id}" id="friend-${f.id}" style="width: 18px; height: 18px; cursor: pointer;">
          <label for="friend-${f.id}" style="color: #e2e8f0; cursor: pointer; flex-grow: 1;">${f.username}</label>
        </div>
      `;
    });

    const { value: formValues } = await (window as any).Swal.fire({
      title: '<span style="font-family: \'Audiowide\', cursive; color: #fff;">Nuevo Grupo</span>',
      html: `
        <input id="group-name" class="swal2-input" placeholder="Nombre del grupo..." style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; font-size: 1rem;">
        <div style="text-align: left; margin-top: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
          <h4 style="color: #a855f7; margin-bottom: 15px; font-size: 0.8rem; letter-spacing: 1px;">INVITAR AMIGOS</h4>
          <div style="max-height: 200px; overflow-y: auto; padding-right: 5px;">
            ${optionsHtml || '<p style="color: rgba(255,255,255,0.4); text-align: center; font-size: 0.9rem;">No tienes amigos para invitar.</p>'}
          </div>
        </div>
      `,
      background: '#0a0f18',
      confirmButtonText: 'CREAR GRUPO',
      confirmButtonColor: '#a855f7',
      showCancelButton: true,
      cancelButtonText: 'CANCELAR',
      buttonsStyling: true,
      customClass: {
        popup: 'glass-modal',
        confirmButton: 'btn-swal-confirm',
        cancelButton: 'btn-swal-cancel'
      },
      preConfirm: () => {
        const name = (document.getElementById('group-name') as HTMLInputElement).value;
        const checkboxes = document.querySelectorAll('.swal2-checkbox-group:checked') as NodeListOf<HTMLInputElement>;
        const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (!name) {
          (window as any).Swal.showValidationMessage('¡Ponle un nombre al grupo!');
          return false;
        }
        if (memberIds.length === 0) {
          (window as any).Swal.showValidationMessage('Debes seleccionar al menos un amigo.');
          return false;
        }
        
        return { name, memberIds };
      }
    });

    if (formValues) {
      const user = this.currentUser();
      if (!user) return;
      
      this.chatService.createGroup(formValues.name, user.id, formValues.memberIds).subscribe({
        next: (group) => {
          this.loadGroups();
          (window as any).Swal.fire({
            icon: 'success',
            title: 'Grupo creado',
            background: '#0a0f18',
            color: '#fff',
            showConfirmButton: false,
            timer: 1500
          });
        },
        error: (err) => {
          (window as any).Swal.fire('Error', 'No se pudo crear el grupo', 'error');
        }
      });
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      } catch(err) { }
    }, 100);
  }
}
