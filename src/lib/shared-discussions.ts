import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { useCloudSync } from '@/components/cloud-sync-provider';
import {
  firebaseConfigurationAvailable,
  getFirebaseServices,
} from '@/lib/firebase-client';
import type {
  DiscussionPost,
  DiscussionPostType,
  DiscussionReply,
  QuestionId,
} from '@/lib/types';
import { useAppState } from '@/state/app-state';

const IMAGE_UPLOAD_TIMEOUT_MS = 30_000;

export function withUploadTimeout<T>(operation: Promise<T>, timeoutMs = IMAGE_UPLOAD_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('圖片上傳逾時，請確認網路連線與 Firebase Storage 設定。')),
      timeoutMs,
    );
    operation.then(
      (result) => {
        window.clearTimeout(timeout);
        resolve(result);
      },
      (reason) => {
        window.clearTimeout(timeout);
        reject(reason);
      },
    );
  });
}

export interface SharedDiscussionPost extends DiscussionPost {
  authorId?: string;
  authorName?: string;
  likedByCurrentUser?: boolean;
  ownedByCurrentUser?: boolean;
}

export interface DiscussionPublishResult {
  imagesShared: boolean;
}

export function createCloudDiscussionPostData({
  questionId,
  type,
  content,
  images,
  authorId,
  createdAt,
}: {
  questionId: QuestionId;
  type: DiscussionPostType;
  content: string;
  images: DiscussionPost['images'];
  authorId: string;
  createdAt: unknown;
}) {
  return {
    questionId,
    type,
    content,
    images,
    authorId,
    authorName: '匿名使用者',
    createdAt,
    deleted: false,
  };
}

function timestampToIso(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate().toISOString();
  }
  return new Date().toISOString();
}

export function parseCloudDiscussionPost(id: string, data: DocumentData) {
  if (
    data.deleted === true ||
    typeof data.questionId !== 'string' ||
    !['explanation', 'supplement', 'question', 'correction'].includes(data.type) ||
    typeof data.content !== 'string' ||
    typeof data.authorId !== 'string'
  ) {
    return null;
  }
  return {
    id,
    questionId: data.questionId as QuestionId,
    type: data.type as DiscussionPostType,
    content: data.content,
    images: Array.isArray(data.images)
      ? data.images.flatMap((image: unknown) => {
          if (
            !image ||
            typeof image !== 'object' ||
            !('id' in image) ||
            !('name' in image) ||
            !('type' in image) ||
            !('dataUrl' in image) ||
            typeof image.id !== 'string' ||
            typeof image.name !== 'string' ||
            typeof image.type !== 'string' ||
            typeof image.dataUrl !== 'string' ||
            !image.dataUrl.startsWith('https://')
          ) return [];
          return [{ id: image.id, name: image.name, type: image.type, dataUrl: image.dataUrl }];
        })
      : [],
    createdAt: timestampToIso(data.createdAt),
    likes: 0,
    replies: [],
    reported: false,
    authorId: data.authorId,
    authorName:
      typeof data.authorName === 'string' && data.authorName.trim()
        ? data.authorName
        : '匿名使用者',
  } satisfies SharedDiscussionPost;
}

export function parseCloudDiscussionReply(id: string, data: DocumentData) {
  if (typeof data.content !== 'string' || typeof data.authorId !== 'string') {
    return null;
  }
  return {
    id,
    content: data.content,
    createdAt: timestampToIso(data.createdAt),
    authorId: data.authorId,
  } satisfies DiscussionReply & { authorId: string };
}

export function useDiscussionPublisher(questionId: QuestionId) {
  const { dispatch } = useAppState();
  const enabled = firebaseConfigurationAvailable();

  const publish = useCallback(
    async (
      type: DiscussionPostType,
      content: string,
      images: DiscussionPost['images'] = [],
    ) => {
      const trimmed = content.trim();
      if (!trimmed && !images.length) {
        throw new Error('請先輸入要分享的內容或加入圖片。');
      }
      if (!enabled) {
        const now = new Date().toISOString();
        dispatch({
          type: 'add-discussion-post',
          post: {
            id: `post-${questionId}-${now}`,
            questionId,
            type,
            content: trimmed,
            images,
            createdAt: now,
            likes: 0,
            replies: [],
            reported: false,
          },
        });
        return { imagesShared: true } satisfies DiscussionPublishResult;
      }
      const firebase = getFirebaseServices();
      if (!firebase) throw new Error('Firebase 尚未完成設定。');
      const user = firebase.auth.currentUser;
      if (!user) throw new Error('請先使用 Google 登入後再分享。');
      const postRef = doc(collection(firebase.db, 'discussionPosts'));
      let uploadedImages: DiscussionPost['images'] = [];
      try {
        uploadedImages = await Promise.all(
          images.map(async (image) => {
            const imageRef = ref(
              firebase.storage,
              `discussion-images/${user.uid}/${postRef.id}/${image.id}`,
            );
            await withUploadTimeout(
              uploadString(imageRef, image.dataUrl, 'data_url', {
                contentType: image.type,
              }),
            );
            return {
              ...image,
              dataUrl: await withUploadTimeout(getDownloadURL(imageRef)),
            };
          }),
        );
      } catch {
        // Firebase Storage may be unavailable on the Spark plan. The original
        // images remain in the local note while the text is still published.
        uploadedImages = [];
      }
      if (!trimmed && images.length && !uploadedImages.length) {
        throw new Error(
          '目前方案無法共享圖片。請加入文字後再分享；圖片仍會保存在本機筆記。',
        );
      }
      await setDoc(postRef, createCloudDiscussionPostData({
        questionId,
        type,
        content: trimmed,
        images: uploadedImages,
        authorId: user.uid,
        createdAt: serverTimestamp(),
      }));
      return {
        imagesShared: images.length === 0 || uploadedImages.length === images.length,
      } satisfies DiscussionPublishResult;
    },
    [dispatch, enabled, questionId],
  );

  return { publish, enabled };
}

export function useDiscussionQuestionIds() {
  const { state } = useAppState();
  const enabled = firebaseConfigurationAvailable();
  const [cloudQuestionIds, setCloudQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;
    return onSnapshot(collection(firebase.db, 'discussionPosts'), (snapshot) => {
      setCloudQuestionIds([
        ...new Set(
          snapshot.docs.flatMap((item) => {
            const data = item.data();
            return data.deleted !== true && typeof data.questionId === 'string'
              ? [data.questionId]
              : [];
          }),
        ),
      ]);
    });
  }, [enabled]);

  return useMemo(
    () =>
      new Set(
        enabled
          ? cloudQuestionIds
          : state.discussionPosts.map((post) => post.questionId),
      ),
    [cloudQuestionIds, enabled, state.discussionPosts],
  );
}

export function useSharedDiscussions(questionId: QuestionId) {
  const { state, dispatch } = useAppState();
  const { user, signIn } = useCloudSync();
  const enabled = firebaseConfigurationAvailable();
  const [cloudPosts, setCloudPosts] = useState<SharedDiscussionPost[]>([]);
  const [repliesByPost, setRepliesByPost] = useState<
    Record<string, Array<DiscussionReply & { authorId: string }>>
  >({});
  const [likesByPost, setLikesByPost] = useState<
    Record<string, { count: number; liked: boolean }>
  >({});
  const [reportedPostIds, setReportedPostIds] = useState<string[]>([]);
  const [loadedQuestionId, setLoadedQuestionId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;
    const postsQuery = query(
      collection(firebase.db, 'discussionPosts'),
      where('questionId', '==', questionId),
    );
    return onSnapshot(
      postsQuery,
      (snapshot) => {
        const posts = snapshot.docs
          .flatMap((item) => {
            const post = parseCloudDiscussionPost(item.id, item.data());
            return post ? [post] : [];
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        setCloudPosts(posts);
        setLoadedQuestionId(questionId);
        setError('');
      },
      () => {
        setError('無法讀取共享投稿，請確認 Firestore 規則與網路連線。');
        setLoadedQuestionId(questionId);
      },
    );
  }, [enabled, questionId]);

  const postIdsKey = cloudPosts.map((post) => post.id).join('|');
  useEffect(() => {
    if (!enabled || !postIdsKey) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;
    const stops: Unsubscribe[] = [];
    cloudPosts.forEach((post) => {
      stops.push(
        onSnapshot(
          collection(firebase.db, 'discussionPosts', post.id, 'replies'),
          (snapshot) => {
            const replies = snapshot.docs
              .flatMap((item) => {
                const reply = parseCloudDiscussionReply(item.id, item.data());
                return reply ? [reply] : [];
              })
              .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
            setRepliesByPost((current) => ({ ...current, [post.id]: replies }));
          },
        ),
      );
      stops.push(
        onSnapshot(
          collection(firebase.db, 'discussionPosts', post.id, 'likes'),
          (snapshot) => {
            setLikesByPost((current) => ({
              ...current,
              [post.id]: {
                count: snapshot.size,
                liked: user ? snapshot.docs.some((item) => item.id === user.uid) : false,
              },
            }));
          },
        ),
      );
      if (user) {
        stops.push(
          onSnapshot(
            doc(firebase.db, 'discussionPosts', post.id, 'reports', user.uid),
            (snapshot) => {
              setReportedPostIds((current) =>
                snapshot.exists()
                  ? [...new Set([...current, post.id])]
                  : current.filter((id) => id !== post.id),
              );
            },
          ),
        );
      }
    });
    return () => stops.forEach((stop) => stop());
  }, [cloudPosts, enabled, postIdsKey, user]);

  const posts = useMemo<SharedDiscussionPost[]>(() => {
    if (!enabled) {
      return state.discussionPosts.filter((post) => post.questionId === questionId);
    }
    return cloudPosts
      .filter((post) => post.questionId === questionId)
      .map((post) => ({
        ...post,
        replies: repliesByPost[post.id] ?? [],
        likes: likesByPost[post.id]?.count ?? 0,
        likedByCurrentUser: likesByPost[post.id]?.liked ?? false,
        reported: reportedPostIds.includes(post.id),
        ownedByCurrentUser: Boolean(user && post.authorId === user.uid),
      }));
  }, [
    cloudPosts,
    enabled,
    likesByPost,
    questionId,
    repliesByPost,
    reportedPostIds,
    state.discussionPosts,
    user,
  ]);

  const requireUser = useCallback(() => {
    if (!user) throw new Error('請先使用 Google 登入後再操作。');
    return user;
  }, [user]);

  const addPost = useCallback(
    async (type: DiscussionPostType, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      if (!enabled) {
        const now = new Date().toISOString();
        dispatch({
          type: 'add-discussion-post',
          post: {
            id: `post-${now}`,
            questionId,
            type,
            content: trimmed,
            images: [],
            createdAt: now,
            likes: 0,
            replies: [],
            reported: false,
          },
        });
        return;
      }
      const activeUser = requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      await addDoc(collection(firebase.db, 'discussionPosts'), createCloudDiscussionPostData({
        questionId,
        type,
        content: trimmed,
        images: [],
        authorId: activeUser.uid,
        createdAt: serverTimestamp(),
      }));
    },
    [dispatch, enabled, questionId, requireUser],
  );

  const addReply = useCallback(
    async (postId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      if (!enabled) {
        dispatch({
          type: 'add-discussion-reply',
          postId,
          reply: {
            id: `reply-${postId}-${new Date().toISOString()}`,
            content: trimmed,
            createdAt: new Date().toISOString(),
          },
        });
        return;
      }
      const activeUser = requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      await addDoc(collection(firebase.db, 'discussionPosts', postId, 'replies'), {
        content: trimmed,
        authorId: activeUser.uid,
        authorName: '匿名使用者',
        createdAt: serverTimestamp(),
      });
    },
    [dispatch, enabled, requireUser],
  );

  const toggleLike = useCallback(
    async (postId: string, liked: boolean) => {
      if (!enabled) {
        dispatch({ type: 'like-discussion-post', postId });
        return;
      }
      const activeUser = requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      const like = doc(firebase.db, 'discussionPosts', postId, 'likes', activeUser.uid);
      if (liked) await deleteDoc(like);
      else {
        await setDoc(like, {
          userId: activeUser.uid,
          createdAt: serverTimestamp(),
        });
      }
    },
    [dispatch, enabled, requireUser],
  );

  const reportPost = useCallback(
    async (postId: string) => {
      if (!enabled) {
        dispatch({ type: 'report-discussion-post', postId });
        return;
      }
      const activeUser = requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      await setDoc(
        doc(firebase.db, 'discussionPosts', postId, 'reports', activeUser.uid),
        { reporterId: activeUser.uid, createdAt: serverTimestamp() },
      );
      setReportedPostIds((current) => [...new Set([...current, postId])]);
    },
    [dispatch, enabled, requireUser],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      if (!enabled) {
        dispatch({ type: 'delete-discussion-post', postId });
        return;
      }
      requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      await updateDoc(doc(firebase.db, 'discussionPosts', postId), {
        content: '',
        deleted: true,
        deletedAt: serverTimestamp(),
      });
    },
    [dispatch, enabled, requireUser],
  );

  const deleteReply = useCallback(
    async (postId: string, replyId: string) => {
      if (!enabled) {
        dispatch({ type: 'delete-discussion-reply', postId, replyId });
        return;
      }
      requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      await deleteDoc(
        doc(firebase.db, 'discussionPosts', postId, 'replies', replyId),
      );
    },
    [dispatch, enabled, requireUser],
  );

  return {
    posts,
    enabled,
    loading: enabled && loadedQuestionId !== questionId,
    error,
    user,
    signIn,
    addPost,
    addReply,
    toggleLike,
    reportPost,
    deletePost,
    deleteReply,
  };
}
