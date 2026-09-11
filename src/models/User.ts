import { Document, Schema, model } from 'mongoose';

export const USER_ROLES = ['ADMIN', 'AUTHORITY', 'OPERATOR', 'ANALYST', 'DEVICE'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
      default: 'DEVICE',
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const safeRet = { ...ret } as Record<string, unknown>;
    delete safeRet.password;
    delete safeRet.__v;
    return safeRet;
  }
});

const User = model<IUser>('User', userSchema);

export default User;
