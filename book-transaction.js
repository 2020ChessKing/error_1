import React from 'react';
import { Text, View, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Alert, Image, ToastAndroid, Platform } from 'react-native';
import * as Permissions from 'expo-permissions';
import { BarCodeScanner } from 'expo-barcode-scanner';
import MyHeader from '../header.js';
import * as firebase from 'firebase';
import db from '../config.js';

export default class BookTrans extends React.Component {
    constructor()
    {
      super();
      this.state = {
        hasCameraPermissions: null,
        scanned: false,
        BookID : '',
        StudentID : '',
        buttonState: 'normal',
        transactionMessage : 'Hello',
      }
    }

    getCameraPermissions = async (id) =>
    {
      const { status } = await Permissions.askAsync(Permissions.CAMERA);
      
      this.setState({
        hasCameraPermissions: status === "granted",
        buttonState: id,
        scanned: false
      });
    }

    handleBarCodeScanned = async ({type, data}) =>
    {
      const buttonState = this.state.buttonState;
      if(buttonState === 'BookID')
      {
        this.setState({
          scanned: true,
          BookID : data,
          buttonState: 'normal'
        });
      }
      else if(buttonState === 'StudentID')
      {
        this.setState({
          scanned: true,
          StudentID : data,
          buttonState: 'normal'
        });
      }
    }

    bookEligibility = async () =>
    {
      const bookRef = db.collection('books').where('bookID', '===', this.state.BookID).get();  
      var transactionType = '';
      
      if(bookRef.docs.length === 0)
      {
        transactionType = false;
      }
      else
      {
        bookRef.docs.map((doc) => 
        {
          var book = doc.data();

          if(book.Availability)
          {
            transactionType = 'issue';
          }
          else
          {
            transactionType = 'return';
          }
        })
      }

      return transactionType;
    }

    studentEligibilityForIssue = async () => 
    {
      const studentRef = db.collection('students').where('StudentId', '===', this.state.StudentID).get();  
      var transactionType = null;

      if(studentRef.docs.length === 0)
      {
        this.setState({
          BookID : '',
          StudentID : '',
        })
        transactionType = false;
        Alert.alert('Student does not exist. Please check studentID');
      }
      else
      {
        studentRef.docs.map((doc) => {
          var student = doc.data();

          if(student.BooksIssued < 2)
          {
            transactionType = true;
          }
          else
          {
            transactionType = false;
            Alert.alert('Please return a bok before issuing this one')
            this.setState({
              BookID : '',
              StudentID : '',
            })
          }
        })
      }

      return transactionType;
    }

    checkStudentEligibilityForReturn = async () => {
      const transactionRef = await db
        .collection("transactions")
        .where("BookID", "===", this.state.BookID)
        .limit(1)
        .get();
      var isStudentEligible = "";
      transactionRef.docs.map((doc) => {
        var lastBookTransaction = doc.data();
        if (lastBookTransaction.StudentId === this.state.StudentID) {
          isStudentEligible = true;
        } 
        else 
        {
          isStudentEligible = false;
          Alert.alert("The book wasn't issued by this student!");
          this.setState({
            StudentID : "",
            BookID : ""
          });
        }
      });
      return isStudentEligible;
    };

    handleTransaction = async () => 
    {
      var transactionMessage = await this.bookEligibility();
      Alert.alert(transactionMessage);
      if(transactionMessage === false)
      {
        Alert.alert('This Book Does Not Exist in Our Library');

        this.setState({
          bookID : null,
          studentID : null,
        })
      }
      else if(transactionMessage === 'issue')
      {
        var studentEligibility = await this.studentEligibilityForIssue();

        if(studentEligibility === true)
        {
          this.issueBook();
          
          Alert.alert('Book Issued Successfully');
        }
      }
      else if(transactionMessage === 'return')
      {
        var studentEligibilityforReturn = await this.checkStudentEligibilityForReturn();

        if(studentEligibilityforReturn)
        {
          this.returnBook();

          Alert.alert('Book Issued Successfully');
        }
      }

    }

    issueBook = async () =>
    {
      db.collection('transactions').add({
        'StudentId' : this.state.StudentID,
        'BookId' : this.state.BookID,
        'date' : firebase.firestore.Timestamp.now().toDate(),
        'TransactionType' : 'issued', 
      })

      db.collection('books').doc(this.state.BookID).update({
        'Availability' : false,
      })

      db.collection('students').doc(this.state.StudentID).update({
        'BooksIssued' : firebase.firestore.FieldValue.increment(1),
      })
    }

    returnBook = async () =>
    {
      db.collection('transactions').add({
        'StudentId' : this.state.StudentID,
        'BookId' : this.state.BookID,
        'date' : firebase.firestore.Timestamp.now().toDate(),
        'TransactionType' : 'ruturned', 
      })

      db.collection('books').doc(this.state.BookID).update({
        'Availability' : true,
      })

      db.collection('students').doc(this.state.StudentID).update({
        'BooksIssued' : firebase.firestore.FieldValue.increment(-1),
      })
    }

    render() {
      const hasCameraPermissions = this.state.hasCameraPermissions;
      const scanned = this.state.scanned;
      const buttonState = this.state.buttonState;

      if (buttonState !== 'normal' && hasCameraPermissions){
        return(
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
            style = { StyleSheet.absoluteFillObject }
          />
        );
      }

      else if (buttonState === "normal"){
        return(
          <KeyboardAvoidingView style = {styles.container} behaviour = 'padding' enabled = {true}>
            <View>
              <Image style = {{width : 200, height : 200}} source = {require('../assets/booklogo.jpg')}/>
              <MyHeader title = 'Book-Transaction'/>
            </View>

            <View style = {styles.inputView}>
              <TextInput 
                placeholder = 'Book Id' 
                value = {this.state.BookID} 
                style = {styles.inputBox} 
                onChangeText = {(data) => {this.setState({ 
                  BookID : data,
            })}}/>
              <TouchableOpacity
                onPress = {() => {this.getCameraPermissions('BookID')}}
                style={styles.scanButton}>
                <Text style={styles.buttonText}>Scan QR Code</Text>
              </TouchableOpacity>
            </View>

            <View style = {styles.inputView}>
              <TextInput 
                placeholder = 'Student Id' 
                value = {this.state.StudentID} 
                style = {styles.inputBox}
                onChangeText = {(data) => {this.setState({ 
                  StudentID : data,
              })}}/>
                <TouchableOpacity
                onPress = {() => {this.getCameraPermissions('StudentID')}}
                style={styles.scanButton}>
                  <Text style={styles.buttonText}>Scan QR Code</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress = { async () => {
              var transactionMessage1 = this.handleTransaction();
              Alert.alert(transactionMessage1);
              console.log(transactionMessage1);

              // this.setState({
              //   BookID : '',
              //   StudentID : '',
              // })
              this.setState({
                transactionMessage : transactionMessage1,
              })
            }}>
              <Text>Submit</Text>
            </TouchableOpacity>

            <Text>{this.state.transactionMessage}</Text>


         </KeyboardAvoidingView>
        );
      }
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
    },
    displayText:{
      fontSize: 15,
      textDecorationLine: 'underline'
    },
    scanButton:{
      backgroundColor: '#2196F3',
      padding: 4,
      margin: 0,
    },
    buttonText:{
      fontSize: 20,
    },
    inputView:{
      flexDirection: 'row',
      margin: 20,
      justifyContent: 'center',
      alignItems: 'center'
    },
    inputBox:{
      width: 200,
      height: 40,
      borderWidth: 1.5,
      borderRightWidth: 0,
      fontSize: 20,
    },
  });