require('dotenv').config()

const express = require('express')
, bodyParser = require('body-parser')
, passport = require('passport')
, Auth0Strategy = require('passport-auth0')
, massive = require('massive')
, session = require('express-session')
, movieCtrl = require('./controllers/movieCtrl')
, watchingCtrl = require('./controllers/watchingCtrl')
, movieListCtrl = require('./controllers/movieListCtrl')
, thumbsCtrl = require('./controllers/thumbsCtrl')

const app = express();

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
}));
app.use(bodyParser.json())
app.use(passport.initialize());
app.use(passport.session());


massive(process.env.CONNECTIONSTRING).then( db => {
    app.set('db', db);

    app.get('db').init.seed_file().then(res => console.log(res))
    .catch(err => console.log(err))
})

passport.use(new Auth0Strategy({
    domain: process.env.AUTH_DOMAIN,
    clientID: process.env.AUTH_CLIENT_ID,
    clientSecret: process.env.AUTH_CLIENT_SECRET,
    callbackURL: process.env.AUTH_CALLBACK
}, function(accessToken, refreshToken, extraParams, profile, done) {
    const db = app.get('db');

    db.find_user([ profile.identities[0].user_id ]).then( user => {
        if ( user[0] ) {
            return done( null, user );       
        } else {        
         db.create_user([profile.displayName, profile.emails[0].value, profile.picture, profile.identities[0].user_id]).then( user => {        
               return done( null, user[0] ); 
            })
        }   
    })
}))

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    app.get('db').find_session_user([user.id]).then( user => {
        return done(null, user[0]);
    })
});

app.get('/auth', passport.authenticate('auth0'));
app.get('/auth/callback', passport.authenticate('auth0', {
    successRedirect: 'http://localhost:4001/#/home',
    failureRedirect: 'http://localhost:4001/#/'
}))

app.get('/auth/me', (req, res, next) => {
    if (!req.user) {
        return res.status(404).send('User not found');
    } else {
        return res.status(200).send(req.user);
    }
})
    
app.get('/auth/logout', (req, res) => {
    req.logOut();
    return res.redirect(302, 'http://localhost:4001/#/');
})




app.get('/api/movies', movieCtrl.getAllMovies)
app.get('/api/movie/:id', movieCtrl.getMovie) //Gets movie based off param with movie id. 
app.get('/api/genre', movieCtrl.getGenres) 
app.get('/api/moviesByGenre', movieCtrl.getMoviesByGenre) //Gets movies based off query with genre_id.


app.get('/api/user/watch/:id', watchingCtrl.getToWatchList)
app.post('/api/user/watch/:id', watchingCtrl.addToWatch) //Add to watch list with params of user id and query of movie id.
app.put('/api/user/watch/:id', watchingCtrl.finishedMovie)


// app.get('/api/user/list/:id', movieListCtrl.getMovieList)
// app.post('/api/user/list/:id', movieListCtrl.addToMovieList)
// app.delete('/api/user/list/:id', movieListCtrl.removeFromMovieList)

app.get('/api/user/thumbs/:id', thumbsCtrl.getThumbs)
app.post('/api/user/thumbs/:id', thumbsCtrl.addThumb)
app.put('/api/user/thumbs/:id', thumbsCtrl.updateThumb) //Update thumbs, if no thumbs on body it will delete movie from thumbs table


app.listen(process.env.PORT, () => {
    console.log(`Listening on port: ${process.env.PORT}`);
})   
