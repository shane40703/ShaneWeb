import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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
import { useOptionalCloudSync } from '@/components/cloud-sync-provider';
import {
  firebaseConfigurationAvailable,
  firebaseRunsHere,
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

export function createCloudDiscussionPostUpdateData(
  content: string,
  images: DiscussionPost['images'],
  existingImages: unknown,
) {
  return (!Array.isArray(existingImages) || existingImages.length === 0) && images.length === 0
    ? { content }
    : { content, images };
}

export function createCloudDiscussionPostEditData(
  content: string,
  images: DiscussionPost['images'],
) {
  return {
    content,
    images,
    deleted: false,
  };
}

export function isFirestorePermissionDenied(reason: unknown) {
  if (!reason || typeof reason !== 'object' || !('code' in reason)) return false;
  return reason.code === 'permission-denied' || reason.code === 'firestore/permission-denied';
}

export function deduplicateAuthorExplanations<T extends SharedDiscussionPost>(
  posts: T[],
) {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (post.type !== 'explanation' || !post.authorId) return true;
    const key = `${post.questionId}:${post.authorId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

// Validation trims only to detect empty content; saved notes retain their indentation and blank lines.
export function normalizeDiscussionContent(content: string) {
  return content.trim() ? content : '';
}

export function useDiscussionPublisher(questionId: QuestionId) {
  const { state, dispatch } = useAppState();
  const enabled = firebaseConfigurationAvailable();

  const publish = useCallback(
    async (
      type: DiscussionPostType,
      content: string,
      images: DiscussionPost['images'] = [],
    ) => {
      const formatted = normalizeDiscussionContent(content);
      if (!formatted && !images.length) {
        throw new Error('請先輸入要分享的內容或加入圖片。');
      }
      if (formatted.length > 5000) {
        throw new Error('分享內容含格式最多 5,000 字元，請刪減文字或格式後再分享；原筆記仍會保留。');
      }
      if (!enabled) {
        const existingPost = type === 'explanation'
          ? state.discussionPosts.find(
              (post) => post.questionId === questionId && post.type === type,
            )
          : undefined;
        if (existingPost) {
          dispatch({
            type: 'edit-discussion-post',
            postId: existingPost.id,
            content: formatted,
            images,
          });
          return { imagesShared: true } satisfies DiscussionPublishResult;
        }
        const now = new Date().toISOString();
        dispatch({
          type: 'add-discussion-post',
          post: {
            id: `post-${questionId}-${now}`,
            questionId,
            type,
            content: formatted,
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
      const existingPosts = type === 'explanation'
        ? (await getDocs(query(
            collection(firebase.db, 'discussionPosts'),
            where('questionId', '==', questionId),
          ))).docs.filter((item) => {
            const data = item.data();
            return data.authorId === user.uid && data.type === type && data.deleted !== true;
          })
        : [];
      const sortedExistingPosts = existingPosts.sort((left, right) => {
        const leftCreatedAt = left.data().createdAt;
        const rightCreatedAt = right.data().createdAt;
        const leftMillis = typeof leftCreatedAt?.toMillis === 'function'
          ? leftCreatedAt.toMillis()
          : 0;
        const rightMillis = typeof rightCreatedAt?.toMillis === 'function'
          ? rightCreatedAt.toMillis()
          : 0;
        return rightMillis - leftMillis;
      });
      const postRef = sortedExistingPosts[0]?.ref ?? doc(collection(firebase.db, 'discussionPosts'));
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
      if (!formatted && images.length && !uploadedImages.length) {
        throw new Error(
          '目前方案無法共享圖片。請加入文字後再分享；圖片仍會保存在本機筆記。',
        );
      }
      if (sortedExistingPosts.length) {
        try {
          await updateDoc(
            postRef,
            createCloudDiscussionPostUpdateData(
              formatted,
              uploadedImages,
              sortedExistingPosts[0].data().images,
            ),
          );
        } catch (reason) {
          if (!isFirestorePermissionDenied(reason)) throw reason;
          // Some deployed projects still use the older rules that allowed
          // creating posts but not editing them. Publish a newer replacement;
          // readers deduplicate author explanations and show this latest copy.
          const replacementRef = doc(collection(firebase.db, 'discussionPosts'));
          await setDoc(replacementRef, createCloudDiscussionPostData({
            questionId,
            type,
            content: formatted,
            images: uploadedImages,
            authorId: user.uid,
            createdAt: serverTimestamp(),
          }));
        }
      } else {
        await setDoc(postRef, createCloudDiscussionPostData({
          questionId,
          type,
          content: formatted,
          images: uploadedImages,
          authorId: user.uid,
          createdAt: serverTimestamp(),
        }));
      }
      return {
        imagesShared: images.length === 0 || uploadedImages.length === images.length,
      } satisfies DiscussionPublishResult;
    },
    [dispatch, enabled, questionId, state.discussionPosts],
  );

  return { publish, enabled };
}

const READ_FAILURE = '無法讀取共享投稿，請確認 Firestore 規則與網路連線。';

const subscribeToNothing = () => () => undefined;
const assumeRunning = () => false;
// Asked during render, so it must start nothing: getFirebaseServices() would start Firebase.
const servicesMissing = () => !firebaseRunsHere();

/**
 * Firebase can be configured and still not run on this device (it is held back for crawlers):
 * no listener answers then, so nothing may wait for one. A store, as in useClientReady, so no
 * effect sets state; the server cannot tell, so hydration renders the wait as it always did.
 */
function useFirebaseUnavailable(enabled: boolean) {
  return useSyncExternalStore(
    subscribeToNothing,
    enabled ? servicesMissing : assumeRunning,
    assumeRunning,
  );
}

const NO_POSTS: SharedDiscussionPost[] = [];

/** What a paper's listener last read. */
interface PaperRead {
  /** The questions with shared content, for the tiles. */
  questionIds: string[];
  /** Each question's posts, newest first. */
  posts: ReadonlyMap<string, SharedDiscussionPost[]>;
  /** The read as text, so an answer that changes nothing keeps the read as it is. */
  key: string;
}

const NOTHING_READ: PaperRead = { questionIds: [], posts: new Map(), key: '' };

/**
 * One paper's shared posts. `prefix` is the paper's id prefix: the collection is read only as
 * far as the tiles on screen, by the automatic single-field index on questionId, so opening a
 * paper costs its posts and not everyone's. `questionIds` says which questions have shared
 * content, for its tiles; `posts` holds each question's posts, so the question on screen needs
 * no read of its own (useSharedDiscussions' `paper`).
 * `ready` once this listener has answered, from the server or the device's cache, or failed.
 * `settled` once the server has answered, the read failed or the device is offline: before
 * that, the cache may hold only the posts that other views of this tab read. `error` if it
 * failed.
 */
export function usePaperDiscussions(prefix: string | null) {
  const { state } = useAppState();
  const enabled = firebaseConfigurationAvailable();
  const unavailable = useFirebaseUnavailable(enabled);
  const [read, setRead] = useState<PaperRead>(NOTHING_READ);
  // The paper whose listener has answered, the one it has settled for, and the one it failed.
  const [answeredPrefix, setAnsweredPrefix] = useState<string | null>(null);
  const [settledPrefix, setSettledPrefix] = useState<string | null>(null);
  const [failedPrefix, setFailedPrefix] = useState<string | null>(null);
  // Each paper on screen gets a new listener, back from its overview or another paper too:
  // until that one answers, an earlier listener's answer or failure is not this one's.
  const [listeningTo, setListeningTo] = useState(prefix);
  if (listeningTo !== prefix) {
    setListeningTo(prefix);
    setAnsweredPrefix(null);
    setSettledPrefix(null);
    setFailedPrefix(null);
  }

  useEffect(() => {
    if (!enabled || !prefix) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;
    const paperPosts = query(
      collection(firebase.db, 'discussionPosts'),
      where('questionId', '>=', prefix),
      where('questionId', '<', `${prefix}\uf8ff`),
    );
    return onSnapshot(
      paperPosts,
      // The server's answer can match the cache's, and then only its metadata changes.
      { includeMetadataChanges: true },
      (snapshot) => {
        const questionIds = [
          ...new Set(
            snapshot.docs.flatMap((item) => {
              const data = item.data();
              return data.deleted !== true && typeof data.questionId === 'string'
                ? [data.questionId]
                : [];
            }),
          ),
        ];
        // As a question's own listener reads them: newest first, one explanation per author.
        const posts = deduplicateAuthorExplanations(snapshot.docs
          .flatMap((item) => {
            const post = parseCloudDiscussionPost(item.id, item.data());
            return post ? [post] : [];
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
        const key = JSON.stringify([questionIds, posts]);
        // An answer that changes no post, as the server confirming the cache, keeps the read,
        // so nothing renders again for it.
        setRead((current) => {
          if (current.key === key) return current;
          const byQuestion = new Map<string, SharedDiscussionPost[]>();
          posts.forEach((post) => {
            const questionPosts = byQuestion.get(post.questionId);
            if (questionPosts) questionPosts.push(post);
            else byQuestion.set(post.questionId, [post]);
          });
          return { questionIds, posts: byQuestion, key };
        });
        setAnsweredPrefix(prefix);
        if (!snapshot.metadata.fromCache) setSettledPrefix(prefix);
        setFailedPrefix(null);
      },
      () => {
        // A failed read ends the wait too, or the paper's questions would wait for good.
        setAnsweredPrefix(prefix);
        setSettledPrefix(prefix);
        setFailedPrefix(prefix);
      },
    );
  }, [enabled, prefix]);

  const questionIds = useMemo(
    () =>
      new Set(
        enabled
          ? read.questionIds
          : state.discussionPosts.map((post) => post.questionId),
      ),
    [enabled, read.questionIds, state.discussionPosts],
  );
  // Without Firebase, or without a paper, nothing is read, so nothing waits.
  const reading = enabled && !unavailable && prefix !== null;
  // Offline the server cannot answer, and the cache's answer is all there will be: as the SDK
  // does, take it once the browser says so, or after the SDK's own 10 s.
  const waiting = reading && answeredPrefix === prefix && settledPrefix !== prefix;
  useEffect(() => {
    if (!waiting) return;
    const settle = () => setSettledPrefix(prefix);
    const timer = window.setTimeout(settle, navigator.onLine ? 10_000 : 0);
    window.addEventListener('offline', settle);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('offline', settle);
    };
  }, [prefix, waiting]);
  return {
    questionIds,
    posts: read.posts,
    ready: !reading || answeredPrefix === prefix,
    settled: !reading || settledPrefix === prefix,
    error: reading && failedPrefix === prefix ? READ_FAILURE : '',
  };
}

/** A paper's read, as usePaperDiscussions gives it to the questions of that paper. */
export type PaperDiscussions = Pick<
  ReturnType<typeof usePaperDiscussions>,
  'posts' | 'ready' | 'settled' | 'error'
>;

/**
 * A question's posts; null (an overview page, no question on screen) listens to nothing.
 * `reactions: false` listens to the posts alone, for views that show no replies or likes:
 * otherwise every post adds a replies, a likes and, signed in, a report listener.
 * `waitForServer` keeps `loading` until the server has answered, for a view that reads on
 * demand: the cache may answer first (an earlier read in this tab, or offline), and its
 * empty answer must not read as "no posts".
 * `paper` takes the posts from the listener of the question's paper, which reads them all
 * anyway: the question then opens no listener for its posts. `loading` lasts until that
 * listener is ready, and until it has settled only posts end the wait: an empty list may just
 * mean the cache answered for the paper with other questions' posts alone. Its failure is the
 * question's error.
 */
export function useSharedDiscussions(
  questionId: QuestionId | null,
  {
    reactions = true,
    waitForServer = false,
    paper,
  }: {
    reactions?: boolean;
    waitForServer?: boolean;
    paper?: PaperDiscussions;
  } = {},
) {
  const { state, dispatch } = useAppState();
  const cloud = useOptionalCloudSync();
  const user = cloud?.user ?? null;
  const signIn = cloud?.signIn ?? (async () => {});
  const enabled = firebaseConfigurationAvailable();
  const unavailable = useFirebaseUnavailable(enabled);
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

  const fromPaper = paper !== undefined;
  useEffect(() => {
    if (!enabled || !questionId || fromPaper) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;
    const postsQuery = query(
      collection(firebase.db, 'discussionPosts'),
      where('questionId', '==', questionId),
    );
    // A server answer that matches the cached one arrives only as a metadata change.
    return onSnapshot(
      postsQuery,
      { includeMetadataChanges: waitForServer },
      (snapshot) => {
        const posts = deduplicateAuthorExplanations(snapshot.docs
          .flatMap((item) => {
            const post = parseCloudDiscussionPost(item.id, item.data());
            return post ? [post] : [];
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
        setCloudPosts(posts);
        if (!waitForServer || !snapshot.metadata.fromCache) {
          setLoadedQuestionId(questionId);
        }
        setError('');
      },
      () => {
        setError(READ_FAILURE);
        setLoadedQuestionId(questionId);
      },
    );
  }, [enabled, fromPaper, questionId, waitForServer]);

  // The paper's read keeps each question's list as it is until one of its posts changes.
  const questionPosts = paper
    ? (questionId === null ? undefined : paper.posts.get(questionId)) ?? NO_POSTS
    : cloudPosts;
  // Sorted, so posts that only change order are the same set; '/' never appears in a
  // document id, so the key splits back into the ids.
  const postIdsKey = questionPosts.map((post) => post.id).sort().join('/');
  useEffect(() => {
    if (!enabled || !reactions || !postIdsKey) return;
    const firebase = getFirebaseServices();
    if (!firebase) return;
    const stops: Unsubscribe[] = [];
    // From the ids alone, so editing a post's text or images keeps every listener.
    postIdsKey.split('/').forEach((postId) => {
      stops.push(
        onSnapshot(
          collection(firebase.db, 'discussionPosts', postId, 'replies'),
          (snapshot) => {
            const replies = snapshot.docs
              .flatMap((item) => {
                const reply = parseCloudDiscussionReply(item.id, item.data());
                return reply ? [reply] : [];
              })
              .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
            setRepliesByPost((current) => ({ ...current, [postId]: replies }));
          },
        ),
      );
      stops.push(
        onSnapshot(
          collection(firebase.db, 'discussionPosts', postId, 'likes'),
          (snapshot) => {
            setLikesByPost((current) => ({
              ...current,
              [postId]: {
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
            doc(firebase.db, 'discussionPosts', postId, 'reports', user.uid),
            (snapshot) => {
              setReportedPostIds((current) =>
                snapshot.exists()
                  ? [...new Set([...current, postId])]
                  : current.filter((id) => id !== postId),
              );
            },
          ),
        );
      }
    });
    return () => stops.forEach((stop) => stop());
  }, [enabled, postIdsKey, reactions, user]);

  const posts = useMemo<SharedDiscussionPost[]>(() => {
    if (!enabled) {
      return state.discussionPosts
        .filter((post) => post.questionId === questionId)
        .map((post) => ({ ...post, ownedByCurrentUser: true }));
    }
    return questionPosts
      .filter((post) => post.questionId === questionId)
      .map((post) => ({
        ...post,
        // Only the reaction listeners keep these current, so without them a post has none.
        ...(reactions
          ? {
              replies: repliesByPost[post.id] ?? [],
              likes: likesByPost[post.id]?.count ?? 0,
              likedByCurrentUser: likesByPost[post.id]?.liked ?? false,
              reported: reportedPostIds.includes(post.id),
            }
          : { replies: [], likes: 0, likedByCurrentUser: false, reported: false }),
        ownedByCurrentUser: Boolean(user && post.authorId === user.uid),
      }));
  }, [
    enabled,
    likesByPost,
    questionId,
    questionPosts,
    reactions,
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
      const formatted = normalizeDiscussionContent(content);
      if (!formatted || !questionId) return;
      if (!enabled) {
        const now = new Date().toISOString();
        dispatch({
          type: 'add-discussion-post',
          post: {
            id: `post-${now}`,
            questionId,
            type,
            content: formatted,
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
        content: formatted,
        images: [],
        authorId: activeUser.uid,
        createdAt: serverTimestamp(),
      }));
    },
    [dispatch, enabled, questionId, requireUser],
  );

  const addReply = useCallback(
    async (postId: string, content: string) => {
      const formatted = normalizeDiscussionContent(content);
      if (!formatted) return;
      if (!enabled) {
        dispatch({
          type: 'add-discussion-reply',
          postId,
          reply: {
            id: `reply-${postId}-${new Date().toISOString()}`,
            content: formatted,
            createdAt: new Date().toISOString(),
          },
        });
        return;
      }
      const activeUser = requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      await addDoc(collection(firebase.db, 'discussionPosts', postId, 'replies'), {
        content: formatted,
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

  const editPost = useCallback(
    async (postId: string, content: string) => {
      const formatted = normalizeDiscussionContent(content);
      if (!formatted) throw new Error('投稿內容不可為空白。');
      if (!enabled) {
        dispatch({ type: 'edit-discussion-post', postId, content: formatted });
        return;
      }
      requireUser();
      const firebase = getFirebaseServices();
      if (!firebase) return;
      const post = posts.find((candidate) => candidate.id === postId);
      if (!post) throw new Error('找不到要編輯的投稿，請重新整理後再試。');
      await updateDoc(
        doc(firebase.db, 'discussionPosts', postId),
        createCloudDiscussionPostEditData(formatted, post.images),
      );
    },
    [dispatch, enabled, posts, requireUser],
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

  const loaded = paper
    ? paper.ready && (paper.settled || questionPosts.length > 0)
    : loadedQuestionId === questionId;

  return {
    posts,
    enabled,
    loading: enabled && !unavailable && questionId !== null && !loaded,
    error: paper ? paper.error : error,
    user,
    signIn,
    addPost,
    addReply,
    toggleLike,
    reportPost,
    editPost,
    deletePost,
    deleteReply,
  };
}
