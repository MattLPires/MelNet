export interface RoomMember {
  userId: string;
  nickname: string;
}

export type RoomStatus = "waiting" | "playing" | "closed";

export interface Room {
  id: string;
  name: string;
  password?: string;
  maxPlayers: number;
  gameTag: string;
  hostId: string;
  inviteCode: string;
  status: RoomStatus;
  members: RoomMember[];
}
