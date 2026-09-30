export type Media={id:number;title:string;poster:string;backdrop:string;type:"movie"|"tv";year:string;overview:string;rating:number};

const key=(import.meta.env.VITE_TMDB_API_KEY||"").trim();
const base="https://api.themoviedb.org/3";
const img=(p:string|null,size="w500")=>p?"https://image.tmdb.org/t/p/"+size+p:"";

function map(x:any,type:"movie"|"tv"):Media{
  return{
    id:x.id,
    title:x.title||x.name||"بدون عنوان",
    poster:img(x.poster_path),
    backdrop:img(x.backdrop_path,"w1280"),
    type,
    year:(x.release_date||x.first_air_date||"").slice(0,4),
    overview:x.overview||"لا يوجد وصف متاح.",
    rating:Number(x.vote_average||0)
  };
}

/*
 * Built-in starter catalog.
 * This keeps the app usable when TMDB credentials are not configured.
 * When VITE_TMDB_API_KEY is available, live TMDB data is used instead.
 */
const FALLBACK:Media[]=[
  {id:550,title:"Fight Club",poster:"https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/hZkgoQYus5vegHoetLkCJzb17zJ.jpg",type:"movie",year:"1999",overview:"A dark psychological drama about identity, routine and rebellion.",rating:8.4},
  {id:27205,title:"Inception",poster:"https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",type:"movie",year:"2010",overview:"A skilled extractor enters dreams to plant an idea.",rating:8.4},
  {id:155,title:"The Dark Knight",poster:"https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg",type:"movie",year:"2008",overview:"Batman faces a criminal mastermind who pushes Gotham into chaos.",rating:8.5},
  {id:157336,title:"Interstellar",poster:"https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/xJHokMbljvjADYdit5fK5G4XqH6.jpg",type:"movie",year:"2014",overview:"Explorers travel through space searching for a future for humanity.",rating:8.5},
  {id:278,title:"The Shawshank Redemption",poster:"https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/iNh3BivHyg5sQRPP1KOkzguEX0H.jpg",type:"movie",year:"1994",overview:"A prisoner holds on to hope and friendship through years of confinement.",rating:8.7},
  {id:680,title:"Pulp Fiction",poster:"https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",type:"movie",year:"1994",overview:"Interlocking stories unfold across Los Angeles.",rating:8.5},
  {id:1399,title:"Game of Thrones",poster:"https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/suopoADq0k8YZr4dQXcU6p5V6xR.jpg",type:"tv",year:"2011",overview:"Noble families struggle for power while an ancient threat rises.",rating:8.4},
  {id:1396,title:"Breaking Bad",poster:"https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRN5.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",type:"tv",year:"2008",overview:"A chemistry teacher enters the criminal world.",rating:9.5},
  {id:66732,title:"Stranger Things",poster:"https://image.tmdb.org/t/p/w500/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",type:"tv",year:"2016",overview:"A group of friends encounters strange events in a small town.",rating:8.6},
  {id:94605,title:"Arcane",poster:"https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/9lLuhV703Hgc2wGkN0rNnV0mX5D.jpg",type:"tv",year:"2021",overview:"Two sisters find themselves on opposing sides of a conflict.",rating:8.7},
  {id:94997,title:"House of the Dragon",poster:"https://image.tmdb.org/t/p/w500/1QdXdRYfktUSONkl1oD5gc6kzP1.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/etj8Ecn1akUpd3E8M6o2Q9p9d7D.jpg",type:"tv",year:"2022",overview:"A royal dynasty faces a succession crisis.",rating:8.4},
  {id:66788,title:"Stranger Things: Special",poster:"https://image.tmdb.org/t/p/w500/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg",backdrop:"https://image.tmdb.org/t/p/w1280/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",type:"tv",year:"2026",overview:"واجهة تجريبية للمكتبة المحلية.",rating:8.0}
];

async function tmdb(path:string){
  if(!key) throw new Error("TMDB_API_KEY_MISSING");
  const r=await fetch(base+path,{headers:{accept:"application/json",Authorization:"Bearer "+key}});
  if(!r.ok) throw new Error("TMDB_REQUEST_FAILED");
  return r.json();
}

export async function getHome(){
  if(!key){
    return{
      movies:FALLBACK.filter(x=>x.type==="movie"),
      shows:FALLBACK.filter(x=>x.type==="tv")
    };
  }
  try{
    const[m,t]=await Promise.all([
      tmdb("/trending/movie/week?language=ar"),
      tmdb("/trending/tv/week?language=ar")
    ]);
    return{
      movies:(m.results||[]).map((x:any)=>map(x,"movie")),
      shows:(t.results||[]).map((x:any)=>map(x,"tv"))
    };
  }catch{
    return{
      movies:FALLBACK.filter(x=>x.type==="movie"),
      shows:FALLBACK.filter(x=>x.type==="tv")
    };
  }
}

export async function searchMedia(q:string){
  if(!key){
    const term=q.trim().toLowerCase();
    return FALLBACK.filter(x=>x.title.toLowerCase().includes(term));
  }
  try{
    const d=await tmdb("/search/multi?language=ar&query="+encodeURIComponent(q)+"&include_adult=false");
    return(d.results||[])
      .filter((x:any)=>x.media_type==="movie"||x.media_type==="tv")
      .map((x:any)=>map(x,x.media_type));
  }catch{
    const term=q.trim().toLowerCase();
    return FALLBACK.filter(x=>x.title.toLowerCase().includes(term));
  }
}

export async function getDetails(id:number,type:"movie"|"tv"){
  if(!key){
    const item=FALLBACK.find(x=>x.id===id&&x.type===type);
    return item?{...item,genres:[],seasons:[]}:null;
  }
  const d=await tmdb("/"+type+"/"+id+"?language=ar");
  return{...map(d,type),genres:(d.genres||[]).map((g:any)=>g.name),seasons:d.seasons||[]};
}
